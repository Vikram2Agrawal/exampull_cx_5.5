import { storeVisualFeedbackArtifact } from "@/lib/exams/artifacts";
import { adminDb, adminStorage, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { compileLatex } from "@/lib/latex/client";
import { sanitizeLatex } from "@/lib/latex/sanitize";
import { extractTextFromPdf } from "@/lib/materials/extract-text";

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
	submissionText,
}: {
	filename: string;
	feedback: string;
	score: number | null;
	maxScore: number | null;
	submissionText: string;
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
	const submissionLines = submissionText
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 24);
	const submittedWork =
		submissionLines.length > 0
			? submissionLines
					.map((line) => `${latexEscape(line.slice(0, 120))}\\\\[0.045in]`)
					.join("\n")
			: `${latexEscape(`Uploaded answer file: ${filename}`)}\\\\[0.045in]`;

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
\vspace{0.1in}
\textbf{Attempt:} ${latexEscape(filename)}
\vspace{0.16in}

\noindent\begin{minipage}[t]{0.66\textwidth}
\setlength{\fboxsep}{9pt}
\fcolorbox{annotate}{annotate!4}{%
\begin{minipage}[t][7.15in][t]{0.92\linewidth}
{\scriptsize\color{annotate}\textbf{Annotated submitted work}}\\[0.08in]
{\small\raggedright
${submittedWork}
}
\vfill
{\scriptsize\color{annotate}Corrections are placed directly beside the work they refer to; use this copy while revising.}
\end{minipage}}
\end{minipage}
\hfill
\begin{minipage}[t]{0.28\textwidth}
{\color{annotate}\bfseries Margin Notes}\\[0.08in]
{\small
\begin{itemize}[leftmargin=*]
${notes}
\end{itemize}
}
\vspace{0.12in}
\fcolorbox{annotate}{annotate!8}{%
\begin{minipage}{0.86\linewidth}
{\small\color{annotate}\textbf{First fix}}\\
{\scriptsize Compare the marked reasoning step with the generated answer key, then rewrite the solution below the original line.}
\end{minipage}}
\end{minipage}
\end{document}
`);
}

async function submissionTextFromAttempt(attempt: FirebaseFirestore.DocumentSnapshot) {
	const filename = String(attempt.get("filename") ?? "attempt");
	const contentType = String(attempt.get("contentType") ?? "");
	const storagePath = String(attempt.get("storagePath") ?? "");

	if (!storagePath) {
		return `Uploaded answer file: ${filename}`;
	}

	if (contentType.startsWith("text/")) {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		return buffer.toString("utf8").slice(0, 50000);
	}

	if (contentType === "application/pdf") {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		return (await extractTextFromPdf(buffer)) || `Uploaded answer file: ${filename}`;
	}

	return `Uploaded answer file: ${filename}`;
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
		const submissionText = await submissionTextFromAttempt(attempt);
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
			submissionText,
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
				visualFeedbackSourceMode: "submission_overlay",
				visualFeedbackSourceExcerpt: submissionText.slice(0, 1000),
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
