import { ArrowRight, FileCheck2, GraduationCap, Sparkles } from "lucide-react";
import { PublicNav } from "@/components/layout/site-nav";
import { AnonymousPreview } from "@/components/preview/anonymous-preview";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
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

export default async function LandingPage() {
	const runtimeConfig = await getRuntimeConfig();
	const previewProofPoint = runtimeConfig.previewGenerationDisabled
		? "Preview temporarily paused"
		: "No account preview";

	return (
		<div className="min-h-screen">
			<PublicNav />
			<main>
				<section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.82fr]">
					<div className="space-y-8">
						<SectionHeader title="Exam-ready PDFs from your own course materials">
							<p>
								Upload what you study from, choose the exam shape, and get a
								professional LaTeX-typeset practice exam with answer key and grading
								tools.
							</p>
						</SectionHeader>
						<div className="flex flex-col gap-3 sm:flex-row">
							<ButtonLink href="/sign-up" variant="primary" size="lg">
								Generate your first exam
								<ArrowRight aria-hidden="true" size={18} />
							</ButtonLink>
							<ButtonLink href="/pricing" size="lg">
								See pricing
							</ButtonLink>
						</div>
						<div className="grid gap-3 sm:grid-cols-3">
							{[
								previewProofPoint,
								"40 free credits monthly",
								"Scholar Boost included",
							].map((item) => (
								<GlassPanel key={item} className="p-4 text-sm text-muted">
									{item}
								</GlassPanel>
							))}
						</div>
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
