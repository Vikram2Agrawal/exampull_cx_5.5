"use client";

import { Archive, Bookmark, Copy, Flag, RotateCcw, Share2, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ExamStatus } from "@/lib/product/constants";

type ExamActionsProps = {
	examId: string;
	examStatus: ExamStatus;
	initialBookmarked: boolean;
	initialRating: number | null;
	initialFeedbackText: string | null;
	initialRatingDismissed: boolean;
	initialArchived: boolean;
	cloneUnavailableReason: string | null;
};

async function readJson(response: Response) {
	const body = (await response.json().catch(() => ({}))) as { error?: string };

	if (!response.ok) {
		throw new Error(body.error ?? "Action failed.");
	}

	return body;
}

export function ExamActions({
	examId,
	examStatus,
	initialBookmarked,
	initialRating,
	initialFeedbackText,
	initialRatingDismissed,
	initialArchived,
	cloneUnavailableReason,
}: ExamActionsProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [bookmarked, setBookmarked] = useState(initialBookmarked);
	const [rating, setRating] = useState(initialRating);
	const [selectedRating, setSelectedRating] = useState(initialRating ?? 0);
	const [feedbackText, setFeedbackText] = useState(initialFeedbackText ?? "");
	const [ratingDismissed, setRatingDismissed] = useState(initialRatingDismissed);
	const [shareUrl, setShareUrl] = useState("");
	const [status, setStatus] = useState("");
	const canRate = examStatus === "complete" && rating === null && !ratingDismissed;
	const hasRated = examStatus === "complete" && rating !== null;

	function patchExam(
		payload: Record<string, unknown>,
		successMessage: string,
		onSuccess?: () => void,
	) {
		startTransition(async () => {
			try {
				await readJson(
					await fetch(`/api/exams/${examId}`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload),
					}),
				);
				onSuccess?.();
				setStatus(successMessage);
				router.refresh();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Action failed.");
			}
		});
	}

	function toggleBookmark() {
		const next = !bookmarked;
		setBookmarked(next);
		patchExam({ bookmarked: next }, next ? "Bookmarked." : "Bookmark removed.");
	}

	function rateExam(value: number) {
		setSelectedRating(value);
	}

	function submitRating() {
		if (selectedRating === 0) {
			setStatus("Choose a rating first.");
			return;
		}

		patchExam({ rating: selectedRating, feedbackText }, "Rating saved.", () =>
			setRating(selectedRating),
		);
	}

	function dismissRating() {
		patchExam({ ratingDismissed: true }, "Rating prompt dismissed.", () =>
			setRatingDismissed(true),
		);
	}

	function archiveExam() {
		patchExam({ archived: !initialArchived }, initialArchived ? "Restored." : "Archived.");
		if (!initialArchived) {
			window.setTimeout(() => router.push("/exams"), 500);
		}
	}

	function reportExam() {
		patchExam(
			{
				reportReason:
					"Student reported this generated exam from the exam detail action menu.",
			},
			"Report sent to the review queue.",
		);
	}

	function deleteExam() {
		const firstConfirm = window.confirm("Delete this exam permanently?");
		if (!firstConfirm) {
			return;
		}

		const secondConfirm = window.confirm(
			"Consider archiving instead to preserve your exam history. Delete anyway?",
		);
		if (!secondConfirm) {
			return;
		}

		startTransition(async () => {
			try {
				await readJson(await fetch(`/api/exams/${examId}`, { method: "DELETE" }));
				router.push("/exams");
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Delete failed.");
			}
		});
	}

	function cloneExam() {
		startTransition(async () => {
			try {
				const body = (await readJson(
					await fetch(`/api/exams/${examId}/clone`, { method: "POST" }),
				)) as { examId?: string };
				if (typeof body.examId === "string") {
					router.push(`/exams/${body.examId}`);
				} else {
					router.refresh();
				}
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Clone failed.");
			}
		});
	}

	function shareExam() {
		startTransition(async () => {
			try {
				const body = (await readJson(
					await fetch(`/api/exams/${examId}/share`, { method: "POST" }),
				)) as { shareUrl?: string };
				if (typeof body.shareUrl === "string") {
					setShareUrl(body.shareUrl);
					await navigator.clipboard?.writeText(body.shareUrl);
					setStatus("Share link copied.");
				}
				router.refresh();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Share failed.");
			}
		});
	}

	return (
		<div className="space-y-4">
			<div className="grid gap-2">
				{cloneUnavailableReason ? (
					<div className="flex gap-2 rounded-lg border border-glass-border bg-background/60 p-3 text-sm text-muted">
						<RotateCcw aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
						<span>{cloneUnavailableReason}</span>
					</div>
				) : (
					<Button type="button" onClick={cloneExam} disabled={isPending}>
						<RotateCcw aria-hidden="true" size={18} />
						Create another like this
					</Button>
				)}
				<Button type="button" onClick={shareExam} disabled={isPending}>
					<Share2 aria-hidden="true" size={18} />
					Share exam
				</Button>
				<Button type="button" onClick={toggleBookmark} disabled={isPending}>
					<Bookmark
						aria-hidden="true"
						className={bookmarked ? "fill-premium text-premium" : ""}
						size={18}
					/>
					{bookmarked ? "Bookmarked" : "Bookmark"}
				</Button>
				<Button type="button" onClick={archiveExam} disabled={isPending}>
					<Archive aria-hidden="true" size={18} />
					{initialArchived ? "Restore" : "Archive"}
				</Button>
				{examStatus === "complete" ? (
					<Button
						type="button"
						variant="danger"
						onClick={reportExam}
						disabled={isPending}
					>
						<Flag aria-hidden="true" size={18} />
						Report issue
					</Button>
				) : null}
				<Button type="button" variant="danger" onClick={deleteExam} disabled={isPending}>
					<Trash2 aria-hidden="true" size={18} />
					Delete
				</Button>
			</div>
			{canRate ? (
				<div className="space-y-3 rounded-lg border border-glass-border bg-background/50 p-3">
					<div>
						<p className="text-sm font-medium">Artifact rating</p>
						<p className="mt-1 text-xs text-muted">
							Your feedback helps us improve. We may follow up via email.
						</p>
						<div className="mt-2 flex gap-1">
							{[1, 2, 3, 4, 5].map((value) => (
								<button
									key={value}
									type="button"
									aria-label={`Rate ${value}`}
									className="flex h-11 w-11 items-center justify-center rounded-lg text-premium hover:bg-glass"
									disabled={isPending}
									onClick={() => rateExam(value)}
								>
									<Star
										aria-hidden="true"
										className={value <= selectedRating ? "fill-premium" : ""}
										size={18}
									/>
								</button>
							))}
						</div>
					</div>
					<label className="block text-sm font-medium" htmlFor="exam-feedback-text">
						Optional feedback
					</label>
					<textarea
						id="exam-feedback-text"
						value={feedbackText}
						maxLength={2000}
						onChange={(event) => setFeedbackText(event.target.value)}
						className="min-h-24 w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
						placeholder="What felt realistic, confusing, or off?"
						disabled={isPending}
					/>
					<div className="flex flex-wrap gap-2">
						<Button type="button" onClick={submitRating} disabled={isPending}>
							Submit rating
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={dismissRating}
							disabled={isPending}
						>
							Don't ask again
						</Button>
					</div>
				</div>
			) : null}
			{hasRated ? <p className="text-sm text-muted">Thanks for your feedback!</p> : null}
			{shareUrl ? (
				<div className="flex items-center gap-2 rounded-lg border border-glass-border bg-background/50 p-2 text-xs text-muted">
					<Copy aria-hidden="true" size={14} />
					<span className="min-w-0 flex-1 truncate">{shareUrl}</span>
				</div>
			) : null}
			{status ? <p className="text-sm text-muted">{status}</p> : null}
		</div>
	);
}
