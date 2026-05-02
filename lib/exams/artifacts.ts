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

function artifactPrefix({
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
	const bucket = adminStorage.bucket();
	const prefix = artifactPrefix({ userId, examId, kind });
	const pdfStoragePath = `${prefix}.pdf`;
	const pdfBuffer = Buffer.from(compiled.pdfBase64, "base64");

	await bucket.file(pdfStoragePath).save(pdfBuffer, {
		contentType: "application/pdf",
		metadata: {
			cacheControl: "private, max-age=300",
		},
	});

	const pageStoragePaths = compiled.pages.map(
		(_page, index) => `${prefix}-pages/page-${String(index + 1).padStart(3, "0")}.png`,
	);

	await Promise.all(
		compiled.pages.map((page, index) =>
			bucket.file(pageStoragePaths[index]).save(Buffer.from(page, "base64"), {
				contentType: "image/png",
				metadata: {
					cacheControl: "private, max-age=300",
				},
			}),
		),
	);

	return {
		pdfStoragePath,
		pageStoragePaths,
		pdfBytes: pdfBuffer.byteLength,
	};
}

export async function readStorageBase64(storagePath: string) {
	const [buffer] = await adminStorage.bucket().file(storagePath).download();

	return buffer.toString("base64");
}
