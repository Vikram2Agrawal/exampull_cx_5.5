import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";
import { computeExamCost, createExamConfigSchema } from "@/lib/billing/credits";
import { adminDb, Timestamp } from "@/lib/firebase/admin";
import { enqueueWorkerTask } from "@/lib/tasks/enqueue";

export const createExamRequestSchema = createExamConfigSchema.extend({
	className: z.string().trim().max(80).optional(),
	classId: z.string().trim().max(120).optional(),
	sourceMaterialIds: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
	sourceNotes: z.string().trim().max(2000).optional(),
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
	if (parsed.mode === "power" && user.tier === "free") {
		throw new Error("Power Mode is available on Scholar and Guru.");
	}

	const questionCount =
		parsed.mode === "power" && parsed.powerSlots
			? parsed.powerSlots.length
			: parsed.questionCount;
	const config = {
		...parsed,
		questionCount,
		tier: user.tier,
		mirrorInstructorStyle: parsed.mirrorInstructorStyle ?? true,
	};
	const credits = computeExamCost(config);
	const examId = randomUUID();
	const userRef = adminDb.collection("users").doc(user.uid);
	const examRef = userRef.collection("exams").doc(examId);

	await adminDb.runTransaction(async (transaction) => {
		const userSnapshot = await transaction.get(userRef);
		const availableCredits = Number(userSnapshot.get("credits") ?? 0);
		const reservedCredits = Number(userSnapshot.get("reservedCredits") ?? 0);

		if (availableCredits < credits) {
			throw new Error("Insufficient credits.");
		}

		transaction.update(userRef, {
			credits: availableCredits - credits,
			reservedCredits: reservedCredits + credits,
			updatedAt: Timestamp.now(),
		});
		transaction.create(examRef, {
			status: "queued",
			title: parsed.title || "Untitled practice exam",
			className: parsed.className || "Manual topics",
			classId: parsed.classId || null,
			topics: parsed.topics,
			sourceMaterialIds: parsed.sourceMaterialIds,
			questionCount,
			tierAtGen: user.tier,
			config,
			sourceNotes: parsed.sourceNotes ?? null,
			creditsReserved: credits,
			creditsConsumed: 0,
			archived: false,
			bookmarked: false,
			rating: null,
			shareCount: 0,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
			isTestData: user.isTestAccount,
		});
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

	return { examId, creditsReserved: credits, queueResult };
}
