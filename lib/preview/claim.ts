import { randomUUID } from "node:crypto";
import { adminDb, adminStorage, Timestamp } from "@/lib/firebase/admin";

function stringList(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function timestampExpired(value: unknown, now: FirebaseFirestore.Timestamp) {
	return value instanceof Timestamp && value.toMillis() <= now.toMillis();
}

export async function claimAnonymousPreview({
	previewId,
	userId,
	isTestData,
}: {
	previewId?: string;
	userId: string;
	isTestData: boolean;
}) {
	if (!previewId) {
		return null;
	}

	const previewRef = adminDb.collection("anonymous_previews").doc(previewId);
	const preview = await previewRef.get();
	const now = Timestamp.now();

	if (
		!preview.exists ||
		typeof preview.get("claimedByUid") === "string" ||
		timestampExpired(preview.get("expiresAt"), now)
	) {
		return null;
	}

	const title = String(preview.get("title") ?? "Claimed preview exam");
	const topics = stringList(preview.get("topics"));
	const questionCount = Number(preview.get("questionCount") ?? 3);
	const sourcePdfPath = preview.get("examPdfStoragePath");
	const sourcePagePaths = stringList(preview.get("examRenderedPageStoragePaths"));

	if (typeof sourcePdfPath !== "string" || sourcePdfPath.length === 0) {
		return null;
	}

	const examId = randomUUID();
	const targetPrefix = `users/${userId}/exams/${examId}/artifacts/exam`;
	const targetPdfPath = `${targetPrefix}.pdf`;
	const targetPagePaths = sourcePagePaths.map(
		(_sourcePath, index) =>
			`${targetPrefix}-pages/page-${String(index + 1).padStart(3, "0")}.png`,
	);
	const bucket = adminStorage.bucket();

	await bucket.file(sourcePdfPath).copy(targetPdfPath);
	await Promise.all(
		sourcePagePaths.map((sourcePath, index) => {
			const targetPagePath = `${targetPrefix}-pages/page-${String(index + 1).padStart(3, "0")}.png`;

			return bucket.file(sourcePath).copy(targetPagePath);
		}),
	);

	const examRef = adminDb.collection("users").doc(userId).collection("exams").doc(examId);
	let claimed = false;

	await adminDb.runTransaction(async (transaction) => {
		const currentPreview = await transaction.get(previewRef);

		if (
			!currentPreview.exists ||
			typeof currentPreview.get("claimedByUid") === "string" ||
			timestampExpired(currentPreview.get("expiresAt"), now)
		) {
			return;
		}

		transaction.create(examRef, {
			status: "complete",
			title,
			className: "No-account preview",
			classId: null,
			topics,
			sourceMaterialIds: [],
			adHocUploadIds: [],
			adHocSources: [],
			questionCount,
			tierAtGen: "free",
			config: {
				title,
				topics,
				questionCount,
				tier: "free",
				mode: "standard",
			},
			sourceNotes: "Claimed from a no-account preview.",
			examLatex: currentPreview.get("examLatex") ?? null,
			examPdfStoragePath: targetPdfPath,
			examRenderedPageStoragePaths: targetPagePaths,
			examPdfBytes: Number(currentPreview.get("examPdfBytes") ?? 0),
			examRenderedPageCount: targetPagePaths.length,
			creditsReserved: 0,
			creditsConsumed: 0,
			boostedScholar: false,
			answerKeyUnlocked: false,
			boostGradingIncluded: false,
			archived: false,
			bookmarked: false,
			rating: null,
			shareCount: 0,
			createdAt: now,
			completedAt: now,
			updatedAt: now,
			isTestData,
			anonymousPreviewId: previewId,
		});
		transaction.update(previewRef, {
			claimedByUid: userId,
			claimedExamId: examId,
			claimedAt: now,
			updatedAt: now,
		});
		claimed = true;
	});

	if (!claimed) {
		await Promise.all(
			[targetPdfPath, ...targetPagePaths].map((storagePath) =>
				bucket.file(storagePath).delete({ ignoreNotFound: true }),
			),
		);
		return null;
	}

	return { claimedExamId: examId };
}
