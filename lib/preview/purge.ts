import { adminDb, adminStorage, Timestamp } from "@/lib/firebase/admin";

function stringList(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function anonymousPreviewStoragePaths(data: FirebaseFirestore.DocumentData) {
	const paths = [
		typeof data.examPdfStoragePath === "string" ? data.examPdfStoragePath : "",
		...stringList(data.examRenderedPageStoragePaths),
		...stringList(data.materialStoragePaths),
	].filter((path) => path.length > 0);

	return Array.from(new Set(paths));
}

async function purgeCollection({
	collectionName,
	now,
	limit,
}: {
	collectionName: "anonymous_previews" | "preview_rate_limits";
	now: FirebaseFirestore.Timestamp;
	limit: number;
}) {
	const snapshot = await adminDb
		.collection(collectionName)
		.where("expiresAt", "<=", now)
		.limit(limit)
		.get();
	const bucket = adminStorage.bucket();
	let storageObjectsDeleted = 0;
	const documentIdsDeleted: string[] = [];

	for (const doc of snapshot.docs) {
		if (collectionName === "anonymous_previews") {
			const paths = anonymousPreviewStoragePaths(doc.data());
			await Promise.all(
				paths.map(async (path) => {
					await bucket.file(path).delete({ ignoreNotFound: true });
				}),
			);
			storageObjectsDeleted += paths.length;
		}

		await doc.ref.delete();
		documentIdsDeleted.push(doc.id);
	}

	return {
		documentsDeleted: snapshot.size,
		documentIdsDeleted,
		storageObjectsDeleted,
	};
}

export async function purgeExpiredPreviewData({
	now = Timestamp.now(),
	limit = 100,
}: {
	now?: FirebaseFirestore.Timestamp;
	limit?: number;
} = {}) {
	const boundedLimit = Math.max(1, Math.min(500, limit));
	const [previews, rateLimits] = await Promise.all([
		purgeCollection({ collectionName: "anonymous_previews", now, limit: boundedLimit }),
		purgeCollection({ collectionName: "preview_rate_limits", now, limit: boundedLimit }),
	]);

	return {
		anonymousPreviewsDeleted: previews.documentsDeleted,
		anonymousPreviewIdsDeleted: previews.documentIdsDeleted,
		previewRateLimitsDeleted: rateLimits.documentsDeleted,
		previewRateLimitIdsDeleted: rateLimits.documentIdsDeleted,
		storageObjectsDeleted: previews.storageObjectsDeleted,
	};
}
