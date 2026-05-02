import {
	ArrowRight,
	ClipboardCheck,
	Download,
	FileCheck2,
	GraduationCap,
	Sparkles,
	UploadCloud,
} from "lucide-react";
import { PublicNav } from "@/components/layout/site-nav";
import { ExamArtifactPreview } from "@/components/marketing/exam-artifact-preview";
import { AnonymousPreview } from "@/components/preview/anonymous-preview";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, Paper } from "@/components/ui/surface";
import { getRuntimeConfig } from "@/lib/config/runtime";

export const dynamic = "force-dynamic";

const proofPoints = [
	{
		title: "Looks like an exam, not a chat response",
		body: "Every output is a formal PDF with page numbers, answer space, clean math notation, and a separate answer key.",
		icon: FileCheck2,
	},
	{
		title: "Built from the course you are taking",
		body: "Upload slides, notes, textbooks, photos, or links, then review the topics before credits are reserved.",
		icon: GraduationCap,
	},
	{
		title: "Practice, grade, and learn from the attempt",
		body: "Scholar adds worked grading. Guru adds visual notes directly on the submitted work so mistakes are easier to fix.",
		icon: Sparkles,
	},
] as const;

const workflowSteps = [
	{
		title: "Upload course materials",
		body: "Start with the files and links your instructor actually gave you.",
		icon: UploadCloud,
	},
	{
		title: "Confirm the topic scope",
		body: "Review extracted topics and add anything the exam should emphasize.",
		icon: ClipboardCheck,
	},
	{
		title: "Download a polished PDF",
		body: "Print the exam, complete it under time pressure, then compare against the answer key.",
		icon: Download,
	},
] as const;

function PreviewPaused({ message }: { message: string }) {
	return (
		<GlassPanel className="p-6">
			<p className="text-sm font-medium uppercase tracking-[0.14em] text-secondary">
				Preview paused
			</p>
			<h2 className="mt-4 text-2xl font-semibold">Create a full exam after signup</h2>
			<p className="mt-3 text-sm leading-6 text-muted">{message}</p>
			<ButtonLink href="/sign-up" variant="primary" className="mt-6 w-full">
				Create a free account
				<ArrowRight aria-hidden="true" size={18} />
			</ButtonLink>
		</GlassPanel>
	);
}

function MobileArtifactSignal() {
	return (
		<Paper className="overflow-hidden p-3 lg:hidden" data-testid="mobile-artifact-signal">
			<p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
				Generated Practice Examination
			</p>
			<h2 className="mt-2 text-xl font-semibold leading-tight">Thermodynamics Midterm</h2>
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
					<div className="relative mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[0.92fr_1.08fr]">
						<div className="max-w-3xl space-y-8">
							<div className="space-y-5">
								<p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
									From course files to printable practice
								</p>
								<MobileArtifactSignal />
								<h1 className="text-4xl font-semibold leading-[1] tracking-normal text-foreground sm:text-6xl">
									Practice exams that feel like the real thing
								</h1>
								<p className="max-w-2xl text-lg leading-8 text-muted">
									Upload the materials from your class. ExamPull turns them into a
									polished PDF with realistic questions, answer spaces, an answer
									key, and grading tools for the attempt.
								</p>
							</div>
							<div className="flex flex-col gap-3 sm:flex-row">
								<ButtonLink href="/sign-up" variant="primary" size="lg">
									Start with a free exam
									<ArrowRight aria-hidden="true" size={18} />
								</ButtonLink>
								<ButtonLink href="/pricing" size="lg">
									See pricing
								</ButtonLink>
							</div>
							<div className="grid max-w-2xl gap-3 text-sm text-muted sm:grid-cols-3">
								<div className="rounded-lg border border-glass-border bg-background/55 p-3">
									<p className="font-semibold text-foreground">PDF output</p>
									<p className="mt-1">Formal pages, not loose prompts.</p>
								</div>
								<div className="rounded-lg border border-glass-border bg-background/55 p-3">
									<p className="font-semibold text-foreground">Answer key</p>
									<p className="mt-1">Separated for honest practice.</p>
								</div>
								<div className="rounded-lg border border-glass-border bg-background/55 p-3">
									<p className="font-semibold text-foreground">Attempt grading</p>
									<p className="mt-1">Feedback after you finish.</p>
								</div>
							</div>
						</div>
						<ExamArtifactPreview compact className="hidden lg:block lg:max-w-[600px]" />
					</div>
				</section>
				<section className="mx-auto grid max-w-7xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-3">
					{workflowSteps.map((step, index) => {
						const Icon = step.icon;

						return (
							<GlassPanel key={step.title} className="p-6">
								<div className="flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-lg border border-glass-border bg-background/70 text-secondary">
										<Icon aria-hidden="true" size={20} />
									</div>
									<p className="text-sm font-semibold text-muted">
										Step {index + 1}
									</p>
								</div>
								<h2 className="mt-5 text-xl font-semibold">{step.title}</h2>
								<p className="mt-3 text-sm leading-6 text-muted">{step.body}</p>
							</GlassPanel>
						);
					})}
				</section>
				<section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[0.78fr_1fr]">
					<div className="space-y-4">
						<p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
							Sample before signup
						</p>
						<h2 className="max-w-xl text-3xl font-semibold tracking-normal text-foreground md:text-5xl">
							Preview the kind of exam you can build
						</h2>
						<p className="max-w-xl text-base leading-7 text-muted">
							Use the public preview to inspect the first page style. Full PDF
							downloads, answer keys, and grading are available inside your account.
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
