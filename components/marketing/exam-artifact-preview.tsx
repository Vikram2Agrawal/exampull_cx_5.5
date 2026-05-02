import { CheckCircle2, FileText, Sparkles, UploadCloud } from "lucide-react";
import { Paper } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const sampleQuestions = [
	"Prove that entropy is a state function for a reversible cycle.",
	"Compute the work done during isothermal expansion from V1 to V2.",
	"State the second law in Kelvin-Planck form and give one implication.",
] as const;

const sourceItems = ["Week 7 slides", "Problem set notes", "Instructor style sample"] as const;

export function ExamArtifactPreview({
	className,
	compact = false,
}: {
	className?: string;
	compact?: boolean;
}) {
	const questions = compact ? sampleQuestions.slice(0, 2) : sampleQuestions;

	return (
		<div
			className={cn("relative mx-auto w-full max-w-[600px]", className)}
			data-testid="exam-artifact-preview"
		>
			<div className="absolute -inset-5 rounded-[2rem] border border-glass-border bg-glass/70 shadow-glass" />
			{compact ? null : (
				<div className="absolute -left-6 top-8 z-10 hidden w-48 rounded-lg border border-glass-border bg-background/90 p-3 text-xs text-muted shadow-glass backdrop-blur md:block">
					<div className="flex items-center gap-2 text-secondary">
						<UploadCloud aria-hidden="true" size={15} />
						<span className="font-semibold">Course inputs</span>
					</div>
					<div className="mt-3 space-y-2">
						{sourceItems.map((item) => (
							<div
								key={item}
								className="rounded-md border border-glass-border bg-glass px-2 py-1.5"
							>
								{item}
							</div>
						))}
					</div>
				</div>
			)}
			<div className="absolute right-4 top-2 z-10 hidden rounded-full border border-premium/50 bg-background/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-premium shadow-glass backdrop-blur md:block">
				Print-ready PDF
			</div>
			<Paper
				className={cn(
					"relative overflow-hidden p-6 sm:p-8",
					!compact && "md:ml-10",
					compact ? "min-h-[430px]" : "min-h-[540px]",
				)}
			>
				<div className="flex items-start justify-between gap-4 border-b border-paper-border pb-5">
					<div>
						<p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
							Generated Practice Examination
						</p>
						<h2 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
							Thermodynamics Midterm
						</h2>
						<p className="mt-2 text-sm text-ink-muted">
							Closed notes. Show all work. 75 minutes.
						</p>
					</div>
					<div className="rounded-lg border border-paper-border px-3 py-2 text-center text-xs text-ink-muted">
						<p>Form</p>
						<p className="mt-1 font-sans text-base font-semibold text-ink">A</p>
					</div>
				</div>
				<div className="mt-5 grid grid-cols-2 gap-4 text-xs text-ink-muted">
					<div className="border-b border-paper-border pb-2">Name</div>
					<div className="border-b border-paper-border pb-2">Date</div>
				</div>
				<ol className="mt-7 space-y-6 text-[15px] leading-7 text-ink">
					{questions.map((question, index) => (
						<li key={question} className="grid grid-cols-[auto_1fr] gap-3">
							<span className="font-semibold">{index + 1}.</span>
							<div>
								<p>{question}</p>
								<div className="mt-4 space-y-3">
									<div className="h-px bg-paper-border" />
									<div className="h-px bg-paper-border" />
									{compact && index > 0 ? null : (
										<div className="h-px bg-paper-border" />
									)}
								</div>
							</div>
						</li>
					))}
				</ol>
				<div className="absolute inset-x-6 bottom-5 flex items-center justify-between border-t border-paper-border pt-4 text-[11px] text-ink-muted">
					<span>Page 1 of 6</span>
					<span>Answer key generated separately</span>
				</div>
			</Paper>
			<div className={cn("relative mt-4 grid gap-3 sm:grid-cols-3", !compact && "md:ml-10")}>
				{[
					{ label: "Source-grounded", icon: CheckCircle2 },
					{ label: "Answer key", icon: FileText },
					{ label: "AI grading", icon: Sparkles },
				].map((item) => {
					const Icon = item.icon;

					return (
						<div
							key={item.label}
							className="flex items-center gap-2 rounded-lg border border-glass-border bg-background/80 px-3 py-2 text-xs text-muted backdrop-blur"
						>
							<Icon aria-hidden="true" className="text-secondary" size={14} />
							<span>{item.label}</span>
						</div>
					);
				})}
			</div>
			{compact ? null : (
				<div className="absolute -bottom-5 right-4 hidden w-56 rounded-lg border border-glass-border bg-background/95 p-3 text-xs text-muted shadow-glass backdrop-blur md:block">
					<div className="flex items-center gap-2 text-secondary">
						<Sparkles aria-hidden="true" size={15} />
						<span className="font-semibold">After the attempt</span>
					</div>
					<p className="mt-2 leading-5">
						Upload your work to get a score, worked corrections, and visual notes on
						Guru.
					</p>
				</div>
			)}
		</div>
	);
}
