import { adminStorage } from "@/lib/firebase/admin";

export type ExamArtifactKind = "exam" | "answer";

type CompiledLatex = {
	pdfBase64: string;
	pages: string[];
};

export type StoredExamArtifact = {
	pdfStoragePath: string;
	pageStoragePaths: string[];
	pdfBytes: number;
};

async function storeCompiledArtifact({
	pdfStoragePath,
	pagePrefix,
	compiled,
}: {
	pdfStoragePath: string;
	pagePrefix: string;
	compiled: CompiledLatex;
}) {
	const bucket = adminStorage.bucket();
	const pdfBuffer = Buffer.from(compiled.pdfBase64, "base64");

	await bucket.file(pdfStoragePath).save(pdfBuffer, {
		contentType: "application/pdf",
		metadata: {
			cacheControl: "private, max-age=300",
		},
	});

	const pageStoragePaths = compiled.pages.map(
		(_page, index) => `${pagePrefix}/page-${String(index + 1).padStart(3, "0")}.png`,
	);

	await Promise.all(
		compiled.pages.map((page, index) => {
			const pageStoragePath = pageStoragePaths[index];

			return bucket.file(pageStoragePath).save(Buffer.from(page, "base64"), {
				contentType: "image/png",
				metadata: {
					cacheControl: "private, max-age=300",
				},
			});
		}),
	);

	return {
		pdfStoragePath,
		pageStoragePaths,
		pdfBytes: pdfBuffer.byteLength,
	};
}

function examArtifactPrefix({
	userId,
	examId,
	kind,
}: {
	userId: string;
	examId: string;
	kind: ExamArtifactKind;
}) {
	return `users/${userId}/exams/${examId}/artifacts/${kind}`;
}

export async function storeExamArtifact({
	userId,
	examId,
	kind,
	compiled,
}: {
	userId: string;
	examId: string;
	kind: ExamArtifactKind;
	compiled: CompiledLatex;
}): Promise<StoredExamArtifact> {
	const prefix = examArtifactPrefix({ userId, examId, kind });

	return storeCompiledArtifact({
		pdfStoragePath: `${prefix}.pdf`,
		pagePrefix: `${prefix}-pages`,
		compiled,
	});
}

export async function storeVisualFeedbackArtifact({
	userId,
	attemptId,
	compiled,
}: {
	userId: string;
	attemptId: string;
	compiled: CompiledLatex;
}): Promise<StoredExamArtifact> {
	const prefix = `users/${userId}/attempts/${attemptId}/visual-feedback`;

	return storeCompiledArtifact({
		pdfStoragePath: `${prefix}.pdf`,
		pagePrefix: `${prefix}-pages`,
		compiled,
	});
}

export async function storeAnonymousPreviewArtifact({
	previewId,
	compiled,
}: {
	previewId: string;
	compiled: CompiledLatex;
}): Promise<StoredExamArtifact> {
	const prefix = `anonymous/previews/${previewId}/artifacts/exam`;

	return storeCompiledArtifact({
		pdfStoragePath: `${prefix}.pdf`,
		pagePrefix: `${prefix}-pages`,
		compiled,
	});
}

export async function readStorageBase64(storagePath: string) {
	const [buffer] = await adminStorage.bucket().file(storagePath).download();

	return buffer.toString("base64");
}
