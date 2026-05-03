import { ArrowRight, Bookmark, Download, Share2 } from "lucide-react";
import { GlassPanel, Paper } from "@/components/ui/surface";
import type { ExamSummary } from "@/lib/exams/data";
import { cn } from "@/lib/utils";

export function ExamCard({ exam }: { exam: ExamSummary }) {
	return (
		<GlassPanel interactive className="p-4">
			<a href={`/exams/${exam.id}`} className="block space-y-4">
				<Paper className="aspect-[4/3] overflow-hidden p-5">
					<div className="border-b border-paper-border pb-3 text-center">
						<p className="text-xs uppercase tracking-[0.16em] text-ink-muted">
							{exam.className}
						</p>
						<h3 className="mt-2 text-xl font-semibold leading-tight">{exam.title}</h3>
					</div>
					<ol className="mt-4 space-y-2 text-sm leading-5">
						{exam.topics.slice(0, 3).map((topic, index) => (
							<li key={topic}>
								{index + 1}. {topic}
							</li>
						))}
					</ol>
				</Paper>
				<div className="space-y-3">
					<div className="flex items-start justify-between gap-3">
						<div>
							<h2 className="font-semibold text-foreground">{exam.title}</h2>
							<p className="mt-1 text-sm text-muted">
								{exam.questionCount} questions - {exam.status.replaceAll("_", " ")}
							</p>
						</div>
						<Bookmark
							aria-hidden="true"
							className={cn(
								"h-5 w-5",
								exam.bookmarked ? "fill-premium text-premium" : "text-muted",
							)}
						/>
					</div>
					<div className="flex items-center justify-between gap-3 text-sm text-muted">
						<span className="capitalize">{exam.tierAtGen}</span>
						{exam.rating !== null ? <span>Rating {exam.rating}/5</span> : null}
					</div>
					{exam.shareCount > 0 || exam.archived ? (
						<div className="flex gap-2 text-xs text-muted">
							{exam.shareCount > 0 ? (
								<span>{exam.shareCount} share links</span>
							) : null}
							{exam.archived ? <span>Archived</span> : null}
						</div>
					) : null}
				</div>
			</a>
			<div className="mt-4 flex flex-wrap gap-2 border-t border-glass-border pt-4">
				<a
					href={`/exams/${exam.id}`}
					className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-glass-border bg-glass px-3 text-sm font-medium text-foreground hover:bg-glass-strong"
				>
					Open
					<ArrowRight aria-hidden="true" size={16} />
				</a>
				<a
					href={`/api/exams/${exam.id}/download?type=exam`}
					className={cn(
						"inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-glass-border bg-glass px-3 text-sm font-medium text-foreground hover:bg-glass-strong",
						exam.examPdfReady ? "" : "pointer-events-none opacity-40",
					)}
				>
					<Download aria-hidden="true" size={16} />
					Download
				</a>
				<a
					href={`/exams/${exam.id}`}
					className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-glass-border bg-glass px-3 text-sm font-medium text-foreground hover:bg-glass-strong"
				>
					<Share2 aria-hidden="true" size={16} />
					Share
				</a>
			</div>
		</GlassPanel>
	);
}
