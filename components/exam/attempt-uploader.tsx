"use client";

import { FileCheck2, FileUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AttemptSummary } from "@/lib/exams/attempts";
import type { Tier } from "@/lib/product/constants";

type UploadStartResponse = {
	attemptId?: string;
	uploadUrl?: string;
	error?: string;
};

const maxUploadBytes = 100 * 1024 * 1024;

function feedbackLines(feedback: string) {
	return feedback
		.split(/\n+/)
		.map((line) => line.trim().replace(/^[-*]\s*/, ""))
		.filter(Boolean)
		.slice(0, 6);
}

export function AttemptUploader({
	examId,
	tier,
	boostGradingAvailable,
	visualAnnotationCost,
	attempts,
}: {
	examId: string;
	tier: Tier;
	boostGradingAvailable: boolean;
	visualAnnotationCost: number;
	attempts: AttemptSummary[];
}) {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [file, setFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [visualRequestingAttemptId, setVisualRequestingAttemptId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	function onFileChange(event: ChangeEvent<HTMLInputElement>) {
		setFile(event.target.files?.[0] ?? null);
		setError(null);
	}

	function clearFile() {
		setFile(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!file) {
			setError("Choose an attempt file first.");
			return;
		}

		if (file.size > maxUploadBytes) {
			setError("Uploads are capped at 100 MB per file.");
			return;
		}

		setIsUploading(true);
		setError(null);

		try {
			const startResponse = await fetch(`/api/exams/${examId}/attempts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					filename: file.name,
					contentType: file.type || "application/octet-stream",
					sizeBytes: file.size,
				}),
			});
			const startPayload = (await startResponse.json()) as UploadStartResponse;

			if (!startResponse.ok || !startPayload.uploadUrl || !startPayload.attemptId) {
				throw new Error(startPayload.error ?? "Could not start attempt upload.");
			}

			const uploadResponse = await fetch(startPayload.uploadUrl, {
				method: "PUT",
				headers: { "Content-Type": file.type || "application/octet-stream" },
				body: file,
			});

			if (!uploadResponse.ok) {
				throw new Error("Storage upload failed.");
			}

			const completeResponse = await fetch(
				`/api/exams/${examId}/attempts/${startPayload.attemptId}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status: "uploaded" }),
				},
			);

			if (!completeResponse.ok) {
				const payload = (await completeResponse.json()) as { error?: string };
				throw new Error(payload.error ?? "Could not queue grading.");
			}

			clearFile();
			router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Attempt upload failed.");
		} finally {
			setIsUploading(false);
		}
	}

	async function requestVisualAnnotations(attemptId: string) {
		setVisualRequestingAttemptId(attemptId);
		setError(null);

		try {
			const response = await fetch(
				`/api/exams/${examId}/attempts/${attemptId}/visual-feedback`,
				{
					method: "POST",
				},
			);

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				throw new Error(payload?.error ?? "Could not start visual annotations.");
			}

			router.refresh();
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not start visual annotations.",
			);
		} finally {
			setVisualRequestingAttemptId(null);
		}
	}

	if (tier === "free" && !boostGradingAvailable) {
		return (
			<p className="rounded-lg border border-glass-border bg-background/35 p-4 text-sm text-muted">
				Upgrade to Scholar or Guru to grade attempts against this exam.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<form className="space-y-4" onSubmit={onSubmit}>
				<div>
					<label
						htmlFor="attempt"
						className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-glass-border bg-background/35 px-4 py-5 text-center transition hover:border-brand hover:bg-brand/10"
					>
						<span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand">
							<FileUp aria-hidden="true" size={20} />
						</span>
						<span className="mt-3 text-sm font-semibold">
							{file ? file.name : "Choose attempt file"}
						</span>
						<span className="mt-1 max-w-56 text-sm leading-6 text-muted">
							Upload a PDF, photo, or marked-up scan after you finish the exam.
						</span>
					</label>
					<input
						ref={fileInputRef}
						id="attempt"
						aria-label="Attempt file"
						type="file"
						onChange={onFileChange}
						className="sr-only"
					/>
					{file ? (
						<div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-glass-border bg-background/45 px-3 py-2 text-sm">
							<span className="min-w-0 truncate text-muted">{file.name}</span>
							<button
								type="button"
								className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-glass hover:text-foreground"
								onClick={clearFile}
							>
								<X aria-label="Remove attempt file" size={16} />
							</button>
						</div>
					) : null}
				</div>
				{boostGradingAvailable ? (
					<p className="rounded-lg bg-premium/10 p-3 text-sm text-muted">
						Scholar Boost covers this grading round for free.
					</p>
				) : null}
				{error ? (
					<p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>
				) : null}
				<Button type="submit" variant="primary" disabled={isUploading || !file}>
					<FileUp aria-hidden="true" size={18} />
					{isUploading ? "Uploading" : "Upload and grade"}
				</Button>
			</form>
			{attempts.length > 0 ? (
				<div className="space-y-3">
					{attempts.map((attempt) => (
						<div
							key={attempt.id}
							className="scroll-mt-24 rounded-lg border border-glass-border bg-background/35 p-4 shadow-glass"
						>
							<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
								<div className="flex items-start gap-3">
									<FileCheck2
										aria-hidden="true"
										className="mt-1 text-secondary"
										size={18}
									/>
									<div>
										<p className="font-medium">{attempt.filename}</p>
										<p className="mt-1 text-sm capitalize text-muted">
											{attempt.status.replaceAll("_", " ")}
										</p>
									</div>
								</div>
								{attempt.score !== null && attempt.maxScore !== null ? (
									<div className="rounded-lg border border-glass-border bg-glass px-4 py-3 text-center">
										<p className="text-xs uppercase tracking-[0.12em] text-muted">
											Score
										</p>
										<p className="mt-1 text-2xl font-semibold">
											{attempt.score}/{attempt.maxScore}
										</p>
									</div>
								) : null}
							</div>
							{attempt.feedback ? (
								<div className="mt-4 rounded-lg border border-glass-border bg-glass p-4">
									<p className="text-sm font-semibold">Grading notes</p>
									<ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
										{feedbackLines(attempt.feedback).map((line) => (
											<li key={line} className="flex gap-2">
												<span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
												<span>{line}</span>
											</li>
										))}
									</ul>
								</div>
							) : null}
							{attempt.visualAnnotationStatus ? (
								<p className="mt-3 inline-flex rounded-full border border-premium/40 bg-premium/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-premium">
									Visual annotations:{" "}
									{attempt.visualAnnotationStatus.replaceAll("_", " ")}
								</p>
							) : null}
							{attempt.visualFeedbackReady ? (
								<a
									href={`/api/exams/${examId}/attempts/${attempt.id}/visual-feedback`}
									className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-glass-border bg-glass px-3 text-sm font-medium"
								>
									Download visual feedback
								</a>
							) : attempt.status === "graded" && tier === "guru" ? (
								<div className="mt-4 rounded-lg border border-premium/30 bg-premium/10 p-4">
									<p className="text-sm font-semibold text-premium">
										Need marked-up feedback?
									</p>
									<p className="mt-2 text-sm leading-6 text-muted">
										Generate a downloadable visual annotation PDF for{" "}
										{visualAnnotationCost} credits.
									</p>
									<Button
										type="button"
										variant="premium"
										className="mt-3 w-full px-3"
										aria-label={
											visualRequestingAttemptId === attempt.id
												? "Starting visual annotations"
												: "Generate visual annotations"
										}
										disabled={visualRequestingAttemptId === attempt.id}
										onClick={() => void requestVisualAnnotations(attempt.id)}
									>
										{visualRequestingAttemptId === attempt.id
											? "Starting"
											: "Generate marked PDF"}
									</Button>
								</div>
							) : attempt.status === "graded" ? (
								<p className="mt-3 rounded-lg border border-glass-border bg-background/35 p-3 text-sm text-muted">
									Upgrade to Guru to generate visual annotation PDFs.
								</p>
							) : null}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
