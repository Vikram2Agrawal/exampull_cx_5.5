import { ChevronDown, Download, KeyRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AttemptUploader } from "@/components/exam/attempt-uploader";
import { ExamActions } from "@/components/exam/exam-actions";
import { AppShell } from "@/components/layout/site-nav";
import { Button, ButtonLink } from "@/components/ui/button";
import { GlassPanel, Paper, SectionHeader, StatusMessage } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listExamAttempts } from "@/lib/exams/attempts";
import { getUserExam } from "@/lib/exams/data";
import { CREDIT_COSTS } from "@/lib/product/constants";
import { pipelineStages } from "@/lib/product/demo-data";

function fallbackQuestionPrompt(topic: string, index: number) {
	const prompts = [
		`Explain the central idea behind ${topic}, then give one example that would appear in course materials.`,
		`Solve a practice problem that requires applying ${topic}. Show the main reasoning steps.`,
		`Compare two cases involving ${topic} and identify the condition that changes the answer.`,
		`Interpret a short scenario about ${topic} and justify the final conclusion.`,
	];

	return prompts[index % prompts.length] ?? prompts[0];
}

export default async function ExamDetailPage({ params }: { params: Promise<{ examId: string }> }) {
	const { examId } = await params;
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-up");
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
	const visualAnnotationCost = exam.questionCount * CREDIT_COSTS.ANNOTATE_QUESTION;
	const completedPipelineSteps =
		exam.status === "complete"
			? pipelineStages.length
			: exam.status === "qa_in_progress"
				? 5
				: exam.status === "generating"
					? 3
					: 1;
	const previewQuestions =
		exam.generatedQuestions.length > 0
			? exam.generatedQuestions.map((question, index) => ({
					id: `${exam.id}-generated-${index + 1}`,
					number: index + 1,
					prompt: question.prompt,
					points: question.points,
				}))
			: Array.from({ length: Math.max(1, exam.questionCount) }, (_, questionNumber) => {
					const topic =
						exam.topics[questionNumber % Math.max(1, exam.topics.length)] ??
						"the selected course material";

					return {
						id: `${exam.id}-question-${questionNumber + 1}`,
						number: questionNumber + 1,
						prompt: fallbackQuestionPrompt(topic, questionNumber),
						points: 10,
					};
				});

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
					<div className="hidden gap-2 sm:flex sm:flex-wrap sm:justify-end">
						{exam.examPdfReady ? (
							<ButtonLink
								href={`/api/exams/${exam.id}/download?type=exam`}
								variant="secondary"
								className="w-full sm:w-auto"
							>
								<Download aria-hidden="true" size={18} />
								Exam PDF
							</ButtonLink>
						) : (
							<Button type="button" disabled>
								<Download aria-hidden="true" size={18} />
								Exam PDF
							</Button>
						)}
						{exam.answerKeyPdfReady && canViewAnswerKey ? (
							<ButtonLink
								href={`/api/exams/${exam.id}/download?type=answer`}
								variant="premium"
								className="w-full sm:w-auto"
							>
								<Download aria-hidden="true" size={18} />
								Answer key
							</ButtonLink>
						) : (
							<Button
								type="button"
								variant="premium"
								disabled
								className="w-full sm:w-auto"
							>
								<Download aria-hidden="true" size={18} />
								{user.tier === "free" && !canViewAnswerKey
									? "Answer key locked"
									: "Answer key"}
							</Button>
						)}
					</div>
				</div>
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
					{exam.examPdfReady ? (
						<Paper className="self-start p-8 md:min-h-[560px] md:p-10 lg:sticky lg:top-24">
							<div className="border-b border-paper-border pb-5 text-center">
								<p className="text-xs uppercase tracking-[0.18em] text-ink-muted">
									{exam.className}
								</p>
								<p className="mt-3 text-3xl font-semibold">{exam.title}</p>
								<div className="mt-4 grid grid-cols-2 gap-4 text-left text-xs text-ink-muted">
									<div className="border-b border-paper-border pb-2">Name</div>
									<div className="border-b border-paper-border pb-2">Date</div>
								</div>
							</div>
							<ol className="mt-8 space-y-7 text-base leading-7 text-ink">
								{previewQuestions.slice(0, 8).map((question) => (
									<li
										key={question.id}
										className="grid grid-cols-[auto_1fr] gap-3"
									>
										<span className="font-semibold">{question.number}.</span>
										<div>
											<p>{question.prompt}</p>
											<p className="mt-1 text-xs text-ink-muted">
												[{question.points} points]
											</p>
											<div className="mt-4 space-y-3">
												<div className="h-px bg-paper-border" />
												<div className="h-px bg-paper-border" />
												<div className="h-px bg-paper-border" />
											</div>
										</div>
									</li>
								))}
							</ol>
							<div className="mt-10 border-t border-paper-border pt-4 text-xs text-ink-muted">
								PDF attached. Use the download buttons for the print-ready copy and
								answer key.
							</div>
						</Paper>
					) : (
						<Paper
							interactive
							className="self-start p-10 md:min-h-[680px] lg:sticky lg:top-24"
						>
							<div className="border-b border-paper-border pb-5 text-center">
								<p className="text-xs uppercase tracking-[0.18em] text-ink-muted">
									{exam.className}
								</p>
								<p className="mt-3 text-3xl font-semibold">{exam.title}</p>
								<p className="mt-2 text-sm text-ink-muted">Student copy</p>
							</div>
							<ol className="mt-8 space-y-6 text-base leading-7">
								{previewQuestions.map((question) => (
									<li key={question.id}>
										<strong>{question.number}.</strong> {question.prompt}
										<span className="ml-2 text-xs text-ink-muted">
											[{question.points} points]
										</span>
										<div className="mt-4 h-24 rounded-lg border border-dashed border-paper-border" />
									</li>
								))}
							</ol>
						</Paper>
					)}
					<div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
						<GlassPanel className="p-5">
							<p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
								Practice workflow
							</p>
							<ol className="mt-4 space-y-3">
								<li className="flex gap-3 rounded-lg border border-glass-border bg-background/45 p-3">
									<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-sm font-semibold text-secondary">
										1
									</span>
									<div className="min-w-0">
										<p className="font-medium">Download the student copy</p>
										<p className="mt-1 text-sm leading-6 text-muted">
											Print it or work from the PDF before opening the answer
											key.
										</p>
										{exam.examPdfReady ? (
											<ButtonLink
												href={`/api/exams/${exam.id}/download?type=exam`}
												variant="primary"
												className="mt-3"
											>
												<Download aria-hidden="true" size={18} />
												Download exam
											</ButtonLink>
										) : (
											<Button type="button" disabled className="mt-3">
												<Download aria-hidden="true" size={18} />
												Preparing PDF
											</Button>
										)}
									</div>
								</li>
								<li className="flex gap-3 rounded-lg border border-glass-border bg-background/45 p-3">
									<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-sm font-semibold text-secondary">
										2
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-medium">Upload your completed attempt</p>
										<p className="mt-1 text-sm leading-6 text-muted">
											Get a score and feedback after you finish working.
										</p>
										<div className="mt-4">
											<AttemptUploader
												examId={exam.id}
												tier={user.tier}
												boostGradingAvailable={canUseBoostGrading}
												visualAnnotationCost={visualAnnotationCost}
												attempts={attempts}
											/>
										</div>
									</div>
								</li>
								<li className="flex gap-3 rounded-lg border border-glass-border bg-background/45 p-3">
									<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-sm font-semibold text-secondary">
										3
									</span>
									<div className="min-w-0">
										<p className="font-medium">Review the answer key</p>
										<p className="mt-1 text-sm leading-6 text-muted">
											Use it after practice so the exam still feels realistic.
										</p>
										{exam.answerKeyPdfReady && canViewAnswerKey ? (
											<ButtonLink
												href={`/api/exams/${exam.id}/download?type=answer`}
												variant="secondary"
												className="mt-3"
											>
												<KeyRound aria-hidden="true" size={18} />
												Review key
											</ButtonLink>
										) : (
											<Button
												type="button"
												variant="secondary"
												disabled
												className="mt-3"
											>
												<KeyRound aria-hidden="true" size={18} />
												{user.tier === "free" && !canViewAnswerKey
													? "Solutions locked"
													: "Review key"}
											</Button>
										)}
									</div>
								</li>
							</ol>
						</GlassPanel>
						<GlassPanel className="p-5" role="region" aria-label="Generation tracker">
							<details>
								<summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
									<span className="font-semibold">
										{exam.status === "complete"
											? "Generated successfully"
											: "Generation progress"}
									</span>
									<ChevronDown aria-hidden="true" size={18} />
								</summary>
								<div className="mt-4 space-y-2" role="status" aria-live="polite">
									{pipelineStages.map((stage, index) => (
										<div
											key={stage}
											className="flex items-center justify-between text-sm"
										>
											<span>{stage}</span>
											<span
												className={
													index < completedPipelineSteps
														? "text-success"
														: "text-muted"
												}
											>
												{index < completedPipelineSteps
													? "Done"
													: "Pending"}
											</span>
										</div>
									))}
								</div>
							</details>
							{exam.status === "complete" && !exam.examPdfReady ? (
								<StatusMessage variant="warning" className="mt-4">
									The exam is complete, but the browser preview is unavailable.
									Download still works when the PDF is attached.
								</StatusMessage>
							) : null}
						</GlassPanel>
						<GlassPanel className="p-5">
							<h2 className="font-semibold">Actions</h2>
							<div className="mt-4">
								<ExamActions
									examId={exam.id}
									examStatus={exam.status}
									initialBookmarked={exam.bookmarked}
									initialRating={exam.rating}
									initialFeedbackText={exam.feedbackText}
									initialRatingDismissed={exam.ratingDismissed}
									initialArchived={exam.archived}
									cloneUnavailableReason={exam.cloneUnavailableReason}
									canCreateShareLink={user.tier !== "free"}
									canShareAnswerKey={
										user.tier !== "free" && exam.answerKeyPdfReady
									}
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
					</div>
				</div>
			</div>
		</AppShell>
	);
}
