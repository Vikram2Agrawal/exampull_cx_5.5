import { storeVisualFeedbackArtifact } from "@/lib/exams/artifacts";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { compileLatex } from "@/lib/latex/client";
import { sanitizeLatex } from "@/lib/latex/sanitize";

export type VisualFeedbackInput = {
	userId: string;
	examId: string;
	attemptId: string;
};

function latexEscape(value: string) {
	return value
		.replaceAll("\\", "\\textbackslash{}")
		.replaceAll("&", "\\&")
		.replaceAll("%", "\\%")
		.replaceAll("$", "\\$")
		.replaceAll("#", "\\#")
		.replaceAll("_", "\\_")
		.replaceAll("{", "\\{")
		.replaceAll("}", "\\}")
		.replaceAll("~", "\\textasciitilde{}")
		.replaceAll("^", "\\textasciicircum{}");
}

function buildVisualFeedbackLatex({
	filename,
	feedback,
	score,
	maxScore,
}: {
	filename: string;
	feedback: string;
	score: number | null;
	maxScore: number | null;
}) {
	const lines = feedback
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 12);
	const notes =
		lines.length > 0
			? lines.map((line) => `\\item ${latexEscape(line)}`).join("\n")
			: "\\item Review the missed reasoning steps and compare against the answer key.";
	const scoreLine =
		score !== null && maxScore !== null ? `Score: ${score}/${maxScore}` : "Score pending";

	return sanitizeLatex(String.raw`
\documentclass[11pt]{article}
\usepackage[margin=0.85in]{geometry}
\usepackage{xcolor}
\usepackage{enumitem}
\definecolor{annotate}{HTML}{B45309}
\pagestyle{plain}
\begin{document}
{\Large\bfseries ExamPull Visual Feedback}\\
\vspace{0.08in}
{\color{annotate}\textbf{${latexEscape(scoreLine)}}}\\
\vspace{0.12in}
\textbf{Attempt:} ${latexEscape(filename)}
\vspace{0.2in}
\section*{Margin Notes}
\begin{itemize}[leftmargin=*]
${notes}
\end{itemize}
\vspace{0.2in}
\section*{How to use this sheet}
Mark these notes on the corresponding attempt pages before reworking the exam. Re-answer the highest-impact questions first, then compare against the generated answer key.
\end{document}
`);
}

export async function completeVisualFeedback(input: VisualFeedbackInput) {
	const userRef = adminDb.collection("users").doc(input.userId);
	const attemptRef = userRef
		.collection("exams")
		.doc(input.examId)
		.collection("attempts")
		.doc(input.attemptId);
	const attempt = await attemptRef.get();

	if (!attempt.exists) {
		throw new Error("Attempt not found.");
	}

	const creditsReserved = Number(attempt.get("creditsReserved") ?? 0);

	try {
		await attemptRef.update({
			visualAnnotationStatus: "annotating",
			updatedAt: Timestamp.now(),
		});

		const feedback = String(attempt.get("feedback") ?? "");
		const filename = String(attempt.get("filename") ?? "attempt");
		const score =
			typeof attempt.get("score") === "number" ? Number(attempt.get("score")) : null;
		const maxScore =
			typeof attempt.get("maxScore") === "number" ? Number(attempt.get("maxScore")) : null;
		const annotations = [
			{
				page: 1,
				x: 0.08,
				y: 0.14,
				width: 0.84,
				height: 0.12,
				label: "Review the highest-impact corrections from the grading report.",
				comment: feedback.slice(0, 280) || "Focus on the missed reasoning steps.",
			},
		];
		const visualFeedbackLatex = buildVisualFeedbackLatex({
			filename,
			feedback,
			score,
			maxScore,
		});
		const visualFeedback = await compileLatex({ latex: visualFeedbackLatex });
		const visualArtifact = await storeVisualFeedbackArtifact({
			userId: input.userId,
			attemptId: input.attemptId,
			compiled: visualFeedback,
		});

		await adminDb.runTransaction(async (transaction) => {
			const user = await transaction.get(userRef);
			transaction.update(userRef, {
				reservedCredits: Math.max(
					0,
					Number(user.get("reservedCredits") ?? 0) - creditsReserved,
				),
				totalCreditsConsumed:
					Number(user.get("totalCreditsConsumed") ?? 0) + creditsReserved,
				updatedAt: Timestamp.now(),
			});
			transaction.update(attemptRef, {
				visualAnnotationStatus: "complete",
				visualAnnotationsData: annotations,
				visualFeedbackLatex,
				visualFeedbackPdfStoragePath: visualArtifact.pdfStoragePath,
				visualFeedbackRenderedPageStoragePaths: visualArtifact.pageStoragePaths,
				visualFeedbackPdfBytes: visualArtifact.pdfBytes,
				visualFeedbackRenderedPageCount: visualArtifact.pageStoragePaths.length,
				visualFeedbackPdfBase64: FieldValue.delete(),
				visualFeedbackRenderedPages: FieldValue.delete(),
				creditsReserved: 0,
				creditsConsumed: Number(attempt.get("creditsConsumed") ?? 0) + creditsReserved,
				updatedAt: Timestamp.now(),
			});
		});

		return { ok: true };
	} catch (error) {
		await adminDb.runTransaction(async (transaction) => {
			const user = await transaction.get(userRef);
			transaction.update(userRef, {
				credits: Number(user.get("credits") ?? 0) + creditsReserved,
				reservedCredits: Math.max(
					0,
					Number(user.get("reservedCredits") ?? 0) - creditsReserved,
				),
				updatedAt: Timestamp.now(),
			});
			transaction.update(attemptRef, {
				visualAnnotationStatus: "failed",
				creditsReserved: 0,
				annotationFailureReason:
					error instanceof Error ? error.message : "Visual annotation failed.",
				updatedAt: Timestamp.now(),
			});
		});

		throw error;
	}
}
