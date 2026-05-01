import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";
import { computeExamCost, createExamConfigSchema } from "@/lib/billing/credits";
import { publicSourceUploadMetadata, resolveExamSourceUploads } from "@/lib/exams/source-uploads";
import { adminDb, Timestamp } from "@/lib/firebase/admin";
import { applyReferralExamReward } from "@/lib/referrals";
import { enqueueWorkerTask } from "@/lib/tasks/enqueue";

export const createExamRequestSchema = createExamConfigSchema.extend({
	className: z.string().trim().max(80).optional(),
	classId: z.string().trim().max(120).optional(),
	sourceMaterialIds: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
	adHocUploadIds: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
	sourceNotes: z.string().trim().max(2000).optional(),
	useScholarBoost: z.boolean().default(false),
});

export type CreateExamRequest = z.infer<typeof createExamRequestSchema>;

export async function createExamForUser({
	user,
	input,
}: {
	user: CurrentUser;
	input: CreateExamRequest;
}) {
	const parsed = createExamRequestSchema.parse(input);
	const useScholarBoost = parsed.useScholarBoost && user.tier === "free";
	const generationTier = useScholarBoost ? "scholar" : user.tier;

	if (parsed.mode === "power" && generationTier === "free") {
		throw new Error("Power Mode is available on Scholar and Guru.");
	}

	const questionCount =
		parsed.mode === "power" && parsed.powerSlots
			? parsed.powerSlots.length
			: parsed.questionCount;
	const config = {
		...parsed,
		questionCount,
		tier: generationTier,
		mirrorInstructorStyle: parsed.mirrorInstructorStyle ?? true,
	};
	const computedCost = computeExamCost(config);
	const credits = useScholarBoost ? 0 : computedCost;
	const examId = randomUUID();
	const userRef = adminDb.collection("users").doc(user.uid);
	const examRef = userRef.collection("exams").doc(examId);
	const now = Timestamp.now();

	if (useScholarBoost) {
		const priorExam = await userRef.collection("exams").limit(1).get();
		if (priorExam.empty) {
			throw new Error("Scholar Boost appears after your first generated exam.");
		}
	}

	const adHocUploads = await resolveExamSourceUploads(user.uid, parsed.adHocUploadIds);

	await adminDb.runTransaction(async (transaction) => {
		const userSnapshot = await transaction.get(userRef);
		const availableCredits = Number(userSnapshot.get("credits") ?? 0);
		const reservedCredits = Number(userSnapshot.get("reservedCredits") ?? 0);

		if (useScholarBoost && userSnapshot.get("boostUsedAt")) {
			throw new Error("Scholar Boost has already been used.");
		}

		if (!useScholarBoost && availableCredits < credits) {
			throw new Error("Insufficient credits.");
		}

		if (useScholarBoost) {
			transaction.update(userRef, {
				boostUsedAt: now,
				boostExamId: examId,
				updatedAt: now,
			});
		} else {
			transaction.update(userRef, {
				credits: availableCredits - credits,
				reservedCredits: reservedCredits + credits,
				updatedAt: now,
			});
		}

		transaction.create(examRef, {
			status: "queued",
			title: parsed.title || "Untitled practice exam",
			className: parsed.className || "Manual topics",
			classId: parsed.classId || null,
			topics: parsed.topics,
			sourceMaterialIds: parsed.sourceMaterialIds,
			adHocUploadIds: adHocUploads.map((upload) => upload.id),
			adHocSources: adHocUploads.map(publicSourceUploadMetadata),
			questionCount,
			tierAtGen: generationTier,
			config,
			sourceNotes: parsed.sourceNotes ?? null,
			creditsReserved: credits,
			creditsConsumed: 0,
			boostedScholar: useScholarBoost,
			answerKeyUnlocked: generationTier !== "free" || useScholarBoost,
			boostGradingIncluded: useScholarBoost,
			archived: false,
			bookmarked: false,
			rating: null,
			shareCount: 0,
			createdAt: now,
			updatedAt: now,
			isTestData: user.isTestAccount,
		});
		for (const upload of adHocUploads) {
			transaction.set(
				upload.ref,
				{
					examId,
					lastExamId: examId,
					updatedAt: now,
				},
				{ merge: true },
			);
		}
	});

	const queueResult = await enqueueWorkerTask({
		route: "/api/workers/generate-exam",
		payload: { userId: user.uid, examId },
	});

	if (!queueResult.queued) {
		await examRef.set(
			{
				queueWarning: queueResult.reason,
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
	}
	await applyReferralExamReward(user.uid);

	return { examId, creditsReserved: credits, queueResult };
}
