"use client";

import { FileCheck2, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AttemptSummary } from "@/lib/exams/attempts";
import type { Tier } from "@/lib/product/constants";

type UploadStartResponse = {
	attemptId?: string;
	uploadUrl?: string;
	error?: string;
};

const maxUploadBytes = 100 * 1024 * 1024;

export function AttemptUploader({
	examId,
	tier,
	boostGradingAvailable,
	attempts,
}: {
	examId: string;
	tier: Tier;
	boostGradingAvailable: boolean;
	attempts: AttemptSummary[];
}) {
	const router = useRouter();
	const [file, setFile] = useState<File | null>(null);
	const [visualAnnotations, setVisualAnnotations] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function onFileChange(event: ChangeEvent<HTMLInputElement>) {
		setFile(event.target.files?.[0] ?? null);
		setError(null);
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
					visualAnnotations,
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

			setFile(null);
			setVisualAnnotations(false);
			router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Attempt upload failed.");
		} finally {
			setIsUploading(false);
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
			<form
				className="space-y-4 rounded-lg border border-glass-border bg-background/35 p-4"
				onSubmit={onSubmit}
			>
				<div>
					<label className="text-sm font-medium" htmlFor="attempt">
						Attempt file
					</label>
					<input
						id="attempt"
						type="file"
						onChange={onFileChange}
						className="mt-2 block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
					/>
				</div>
				<label className="flex items-start gap-3 rounded-lg border border-glass-border bg-background/50 p-3 text-sm">
					<input
						type="checkbox"
						checked={visualAnnotations}
						disabled={tier !== "guru"}
						onChange={(event) => setVisualAnnotations(event.target.checked)}
						className="mt-1"
					/>
					<span>
						<span className="font-medium">Visual annotations</span>
						<span className="block text-muted">
							Guru only. Adds a downloadable visual feedback PDF after grading.
						</span>
					</span>
				</label>
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
			<div className="space-y-3">
				{attempts.length === 0 ? (
					<p className="rounded-lg border border-dashed border-glass-border p-5 text-sm text-muted">
						No attempts uploaded yet.
					</p>
				) : (
					attempts.map((attempt) => (
						<div
							key={attempt.id}
							className="rounded-lg border border-glass-border bg-background/35 p-4"
						>
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
										{attempt.score !== null && attempt.maxScore !== null
											? ` - ${attempt.score}/${attempt.maxScore}`
											: ""}
									</p>
								</div>
							</div>
							{attempt.feedback ? (
								<p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">
									{attempt.feedback}
								</p>
							) : null}
							{attempt.visualAnnotationStatus ? (
								<p className="mt-3 text-xs uppercase text-premium-foreground">
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
							) : null}
						</div>
					))
				)}
			</div>
		</div>
	);
}
