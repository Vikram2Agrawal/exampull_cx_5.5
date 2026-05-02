import { Download } from "lucide-react";
import { notFound } from "next/navigation";
import { PublicNav } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, Paper, SectionHeader } from "@/components/ui/surface";
import { getSharedExam } from "@/lib/exams/library";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
	const { shareId } = await params;
	const exam = await getSharedExam(shareId);

	if (!exam) {
		notFound();
	}

	const previewQuestions = Array.from(
		{ length: Math.max(1, exam.questionCount) },
		(_, questionNumber) => {
			const topic =
				exam.topics[questionNumber % Math.max(1, exam.topics.length)] ??
				"the shared course material";

			return {
				id: `${exam.shareId}-question-${questionNumber + 1}`,
				number: questionNumber + 1,
				topic,
			};
		},
	);

	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]">
				{exam.examPdfReady ? (
					<div className="overflow-hidden rounded-lg border border-glass-border bg-paper shadow-paper">
						<iframe
							title={`${exam.title} shared PDF preview`}
							src={`/api/share/${exam.shareId}/download?disposition=inline`}
							className="h-[760px] w-full bg-paper"
						/>
					</div>
				) : (
					<Paper interactive className="min-h-[760px] p-10">
						<div className="border-b border-paper-border pb-5 text-center">
							<p className="text-xs uppercase tracking-[0.18em] text-ink-muted">
								{exam.className}
							</p>
							<h1 className="mt-3 text-3xl font-semibold">{exam.title}</h1>
							<p className="mt-2 text-sm text-ink-muted">Shared student copy</p>
						</div>
						<ol className="mt-8 space-y-6 text-base leading-7">
							{previewQuestions.map((question) => (
								<li key={question.id}>
									<strong>{question.number}.</strong> Answer a representative
									question about {question.topic}.
									<div className="mt-4 h-24 rounded-lg border border-dashed border-paper-border" />
								</li>
							))}
						</ol>
					</Paper>
				)}
				<div className="space-y-4">
					<SectionHeader title="Make one for yourself">
						<p>
							Fork this configuration, add your own materials, and generate a new
							exam.
						</p>
					</SectionHeader>
					<GlassPanel className="p-5">
						{exam.examPdfReady ? (
							<a
								href={`/api/share/${exam.shareId}/download`}
								className="mb-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-glass-border bg-glass px-4 text-sm font-medium"
							>
								<Download aria-hidden="true" size={18} />
								Download shared exam
							</a>
						) : null}
						{exam.answerKeyAvailable ? (
							<a
								href={`/api/share/${exam.shareId}/download?type=answer`}
								className="mb-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-premium px-4 text-sm font-medium text-premium-foreground"
							>
								<Download aria-hidden="true" size={18} />
								Download answer key
							</a>
						) : null}
						<ButtonLink href="/sign-up" variant="primary" className="w-full">
							Customize for yourself
						</ButtonLink>
						<a href="/feedback" className="mt-4 block text-sm text-secondary">
							Something wrong with this exam?
						</a>
					</GlassPanel>
				</div>
			</main>
		</div>
	);
}
