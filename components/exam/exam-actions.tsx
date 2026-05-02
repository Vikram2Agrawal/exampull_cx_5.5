"use client";

import { Archive, Bookmark, Copy, Flag, RotateCcw, Share2, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type ExamActionsProps = {
	examId: string;
	initialBookmarked: boolean;
	initialRating: number | null;
	initialArchived: boolean;
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
	initialBookmarked,
	initialRating,
	initialArchived,
}: ExamActionsProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [bookmarked, setBookmarked] = useState(initialBookmarked);
	const [rating, setRating] = useState(initialRating);
	const [shareUrl, setShareUrl] = useState("");
	const [status, setStatus] = useState("");

	function patchExam(payload: Record<string, unknown>, successMessage: string) {
		startTransition(async () => {
			try {
				await readJson(
					await fetch(`/api/exams/${examId}`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload),
					}),
				);
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
		setRating(value);
		patchExam({ rating: value }, "Rating saved.");
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
				<Button type="button" onClick={cloneExam} disabled={isPending}>
					<RotateCcw aria-hidden="true" size={18} />
					Create another like this
				</Button>
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
				<Button type="button" variant="danger" onClick={reportExam} disabled={isPending}>
					<Flag aria-hidden="true" size={18} />
					Report issue
				</Button>
				<Button type="button" variant="danger" onClick={deleteExam} disabled={isPending}>
					<Trash2 aria-hidden="true" size={18} />
					Delete
				</Button>
			</div>
			<div>
				<p className="text-sm font-medium">Artifact rating</p>
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
								className={rating && value <= rating ? "fill-premium" : ""}
								size={18}
							/>
						</button>
					))}
				</div>
			</div>
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
