import { Download } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AttemptUploader } from "@/components/exam/attempt-uploader";
import { ExamActions } from "@/components/exam/exam-actions";
import { AppShell } from "@/components/layout/site-nav";
import { Button } from "@/components/ui/button";
import { GlassPanel, Paper, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listExamAttempts } from "@/lib/exams/attempts";
import { getUserExam } from "@/lib/exams/data";
import { pipelineStages } from "@/lib/product/demo-data";

export default async function ExamDetailPage({ params }: { params: Promise<{ examId: string }> }) {
	const { examId } = await params;
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	const [exam, attempts] = await Promise.all([
		getUserExam(user.uid, examId),
		listExamAttempts(user.uid, examId),
	]);

	if (!exam) {
		notFound();
	}

	const canViewAnswerKey = user.tier !== "free" || exam.answerKeyUnlocked;
	const canUseBoostGrading =
		user.tier === "free" && exam.boostGradingIncluded && !user.boostGradingUsedAt;
	const previewQuestions = Array.from(
		{ length: Math.max(1, exam.questionCount) },
		(_, questionNumber) => {
			const topic =
				exam.topics[questionNumber % Math.max(1, exam.topics.length)] ??
				"the selected course material";

			return {
				id: `${exam.id}-question-${questionNumber + 1}`,
				number: questionNumber + 1,
				topic,
			};
		},
	);

	return (
		<AppShell
			active="exams"
			unreadNotificationCount={user.unreadNotificationCount}
			theme={user.theme}
		>
			<div className="space-y-8">
				<div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
					<SectionHeader title={exam.title}>
						<p>
							{exam.className} - {exam.questionCount} questions -{" "}
							<span className="capitalize">{exam.status.replaceAll("_", " ")}</span>
						</p>
					</SectionHeader>
					<div className="flex gap-2">
						{exam.examPdfReady ? (
							<a
								href={`/api/exams/${exam.id}/download?type=exam`}
								className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-glass-border bg-glass px-4 text-sm font-medium"
							>
								<Download aria-hidden="true" size={18} />
								Exam PDF
							</a>
						) : (
							<Button type="button" disabled>
								<Download aria-hidden="true" size={18} />
								Exam PDF
							</Button>
						)}
						{exam.answerKeyPdfReady && canViewAnswerKey ? (
							<a
								href={`/api/exams/${exam.id}/download?type=answer`}
								className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-premium px-4 text-sm font-medium text-premium-foreground"
							>
								<Download aria-hidden="true" size={18} />
								Answer key
							</a>
						) : (
							<Button type="button" variant="premium" disabled>
								<Download aria-hidden="true" size={18} />
								{user.tier === "free" && !canViewAnswerKey
									? "Answer key locked"
									: "Answer key"}
							</Button>
						)}
					</div>
				</div>
				<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
					{exam.examPdfReady ? (
						<div className="overflow-hidden rounded-lg border border-glass-border bg-paper shadow-paper">
							<iframe
								title={`${exam.title} PDF preview`}
								src={`/api/exams/${exam.id}/download?type=exam&disposition=inline`}
								className="h-[760px] w-full bg-paper"
							/>
						</div>
					) : (
						<Paper interactive className="min-h-[680px] p-10">
							<div className="border-b border-paper-border pb-5 text-center">
								<p className="text-xs uppercase tracking-[0.18em] text-ink-muted">
									{exam.className}
								</p>
								<h2 className="mt-3 text-3xl font-semibold">{exam.title}</h2>
								<p className="mt-2 text-sm text-ink-muted">Student copy</p>
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
						<GlassPanel className="p-5" role="region" aria-label="Generation tracker">
							<h2 className="font-semibold">Pipeline</h2>
							<div className="mt-4 space-y-2" role="status" aria-live="polite">
								{pipelineStages.map((stage, index) => (
									<div
										key={stage}
										className="flex items-center justify-between text-sm"
									>
										<span>{stage}</span>
										<span className={index < 5 ? "text-success" : "text-muted"}>
											{index < 5 ? "Done" : "Pending"}
										</span>
									</div>
								))}
							</div>
						</GlassPanel>
						<GlassPanel className="p-5">
							<h2 className="font-semibold">Actions</h2>
							<div className="mt-4">
								<ExamActions
									examId={exam.id}
									initialBookmarked={exam.bookmarked}
									initialRating={exam.rating}
									initialArchived={exam.archived}
									cloneUnavailableReason={exam.cloneUnavailableReason}
								/>
							</div>
						</GlassPanel>
						<GlassPanel className="p-5">
							<h2 className="font-semibold">Sources</h2>
							<ul className="mt-3 space-y-3 text-sm text-muted">
								{exam.adHocSources.map((source) => (
									<li key={source.id}>
										<span className="font-medium text-foreground">
											{source.filename}
										</span>
										{source.focus ? (
											<span className="block">Focus: {source.focus}</span>
										) : null}
										{source.extractedTopics.length > 0 ? (
											<span className="block">
												{source.extractedTopics.length} extracted topics
											</span>
										) : null}
									</li>
								))}
								{exam.topics.map((topic) => (
									<li key={topic}>{topic}</li>
								))}
							</ul>
						</GlassPanel>
						<GlassPanel className="p-5">
							<h2 className="font-semibold">Attempts</h2>
							<div className="mt-4">
								<AttemptUploader
									examId={exam.id}
									tier={user.tier}
									boostGradingAvailable={canUseBoostGrading}
									attempts={attempts}
								/>
							</div>
						</GlassPanel>
					</div>
				</div>
			</div>
		</AppShell>
	);
}
