import { ArrowRight, FileCheck2, GraduationCap, Sparkles } from "lucide-react";
import { PublicNav } from "@/components/layout/site-nav";
import { ExamArtifactPreview } from "@/components/marketing/exam-artifact-preview";
import { AnonymousPreview } from "@/components/preview/anonymous-preview";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, Paper } from "@/components/ui/surface";
import { getRuntimeConfig } from "@/lib/config/runtime";

export const dynamic = "force-dynamic";

const proofPoints = [
	{
		title: "Paper-faced output",
		body: "Exam PDFs use formal margins, serif type, answer spaces, page numbers, and print-ready LaTeX.",
		icon: FileCheck2,
	},
	{
		title: "Grounded in your materials",
		body: "Lecture slides, notes, photos, textbooks, and links become scoped topics you can review before generation.",
		icon: GraduationCap,
	},
	{
		title: "Feedback after practice",
		body: "Scholar grades attempts with worked explanations. Guru adds visual annotations directly onto the submission.",
		icon: Sparkles,
	},
] as const;

function PreviewPaused({ message }: { message: string }) {
	return (
		<GlassPanel className="p-6">
			<p className="text-sm font-medium uppercase tracking-[0.14em] text-secondary">
				Preview paused
			</p>
			<h2 className="mt-4 text-2xl font-semibold">Generate a full exam after signup</h2>
			<p className="mt-3 text-sm leading-6 text-muted">{message}</p>
			<ButtonLink href="/sign-up" variant="primary" className="mt-6 w-full">
				Sign up free
				<ArrowRight aria-hidden="true" size={18} />
			</ButtonLink>
		</GlassPanel>
	);
}

function MobileArtifactSignal() {
	return (
		<Paper className="overflow-hidden p-3 lg:hidden">
			<p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
				Generated Practice Examination
			</p>
			<h2 className="mt-2 text-xl font-semibold leading-tight">Thermodynamics and Entropy</h2>
			<div className="mt-3 space-y-2 text-sm leading-6 text-ink">
				<p>
					<strong>1.</strong> Prove that entropy is a state function.
				</p>
				<div className="space-y-2">
					<div className="h-px bg-paper-border" />
					<div className="h-px bg-paper-border" />
				</div>
			</div>
		</Paper>
	);
}

export default async function LandingPage() {
	const runtimeConfig = await getRuntimeConfig();

	return (
		<div className="min-h-screen bg-background">
			<PublicNav />
			<main>
				<section className="relative overflow-hidden border-b border-glass-border">
					<div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(1_0_0_/_0.035)_1px,transparent_1px),linear-gradient(180deg,oklch(1_0_0_/_0.025)_1px,transparent_1px)] bg-[size:72px_72px]" />
					<div className="relative mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.95fr]">
						<div className="max-w-3xl space-y-8">
							<div className="space-y-5">
								<p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
									Glass makes paper
								</p>
								<MobileArtifactSignal />
								<h1 className="text-4xl font-semibold leading-[1] tracking-normal text-foreground sm:text-6xl">
									Professional practice exams from your course materials
								</h1>
								<p className="max-w-2xl text-lg leading-8 text-muted">
									Upload slides, notes, photos, textbooks, or links. ExamPull
									returns a formal LaTeX PDF with answer key, grading, and visual
									feedback.
								</p>
							</div>
							<div className="flex flex-col gap-3 sm:flex-row">
								<ButtonLink href="/sign-up" variant="primary" size="lg">
									Generate your first exam
									<ArrowRight aria-hidden="true" size={18} />
								</ButtonLink>
								<ButtonLink href="/pricing" size="lg">
									See pricing
								</ButtonLink>
							</div>
						</div>
						<ExamArtifactPreview compact className="hidden lg:block lg:max-w-[520px]" />
					</div>
				</section>
				<section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-4 sm:px-6 lg:grid-cols-[0.78fr_1fr]">
					<div className="space-y-4">
						<p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
							Try the press
						</p>
						<h2 className="max-w-xl text-3xl font-semibold tracking-normal text-foreground md:text-5xl">
							Preview the first sheet before you create an account
						</h2>
						<p className="max-w-xl text-base leading-7 text-muted">
							The preview is intentionally small, but it uses the same artifact
							pipeline: course topics in, paper-faced PDF out.
						</p>
					</div>
					{runtimeConfig.previewGenerationDisabled ? (
						<PreviewPaused message={runtimeConfig.previewDisabledMessage} />
					) : (
						<AnonymousPreview />
					)}
				</section>
				<section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
					<div className="grid gap-4 md:grid-cols-3">
						{proofPoints.map((point) => {
							const Icon = point.icon;

							return (
								<GlassPanel key={point.title} className="p-6">
									<Icon aria-hidden="true" className="text-secondary" size={24} />
									<h2 className="mt-5 text-xl font-semibold">{point.title}</h2>
									<p className="mt-3 text-sm leading-6 text-muted">
										{point.body}
									</p>
								</GlassPanel>
							);
						})}
					</div>
				</section>
			</main>
		</div>
	);
}
