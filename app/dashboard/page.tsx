import {
	ArrowRight,
	BookOpen,
	CheckCircle2,
	Coins,
	Download,
	FileText,
	KeyRound,
	UploadCloud,
} from "lucide-react";
import { redirect } from "next/navigation";
import { ExamCard } from "@/components/exam/exam-card";
import { AppShell } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, Paper, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserClasses } from "@/lib/classes/data";
import { listUserExams } from "@/lib/exams/data";
import { pipelineStages } from "@/lib/product/demo-data";
import { formatCredits } from "@/lib/utils";

export default async function DashboardPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-up");
	}

	const [exams, classes] = await Promise.all([
		listUserExams(user.uid, 6),
		listUserClasses(user.uid),
	]);
	const activeExam = exams.find(
		(exam) => exam.status === "generating" || exam.status === "qa_in_progress",
	);
	const readyExam = exams.find((exam) => exam.status === "complete" && exam.examPdfReady);

	return (
		<AppShell
			active="dashboard"
			unreadNotificationCount={user.unreadNotificationCount}
			theme={user.theme}
		>
			<div className="space-y-8">
				<div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
					<SectionHeader title="Your practice exam workspace">
						<p>
							Create a new practice exam, return to work in progress, or open a recent
							PDF from your library.
						</p>
					</SectionHeader>
					<ButtonLink href="/exams/new" variant="primary">
						New practice exam
						<ArrowRight aria-hidden="true" size={18} />
					</ButtonLink>
				</div>
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
					<MetricCard
						icon={Coins}
						label="Credits available"
						value={formatCredits(user.credits)}
					/>
					<MetricCard
						icon={FileText}
						label="Exams in library"
						value={String(exams.length)}
					/>
					<MetricCard
						icon={BookOpen}
						label="Active classes"
						value={String(classes.filter((course) => !course.archived).length)}
					/>
					<MetricCard
						icon={CheckCircle2}
						label="Ready to practice"
						value={String(exams.filter((exam) => exam.status === "complete").length)}
					/>
				</div>
				{readyExam ? <ReadyPracticePanel exam={readyExam} /> : null}
				{activeExam ? (
					<GlassPanel className="p-6">
						<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
							<div>
								<p className="text-sm font-semibold text-secondary">
									Exam in progress
								</p>
								<h2 className="mt-1 text-2xl font-semibold">{activeExam.title}</h2>
							</div>
							<ButtonLink href={`/exams/${activeExam.id}`}>View progress</ButtonLink>
						</div>
						<div className="mt-6 grid gap-2 md:grid-cols-6">
							{pipelineStages.map((stage, index) => (
								<div
									key={stage}
									className="rounded-lg border border-glass-border bg-background/40 p-3 text-sm"
								>
									<p className={index < 4 ? "text-success" : "text-muted"}>
										{stage}
									</p>
								</div>
							))}
						</div>
					</GlassPanel>
				) : null}
				{exams.length === 0 ? <FirstExamPanel /> : null}
				<section>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-2xl font-semibold">Recent exams</h2>
						<a
							href="/exams"
							className="inline-flex min-h-11 items-center text-sm text-secondary"
						>
							View library
						</a>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{exams.length > 0 ? (
							exams.map((exam) => <ExamCard key={exam.id} exam={exam} />)
						) : (
							<GlassPanel className="p-6 md:col-span-3">
								<h3 className="text-lg font-semibold">
									No exams in the library yet
								</h3>
								<p className="mt-2 text-sm text-muted">
									Your completed PDFs, answer keys, and grading history will
									appear here after the first generation.
								</p>
							</GlassPanel>
						)}
					</div>
				</section>
			</div>
		</AppShell>
	);
}

function ReadyPracticePanel({ exam }: { exam: Parameters<typeof ExamCard>[0]["exam"] }) {
	return (
		<GlassPanel className="grid gap-5 p-4 md:p-6 lg:grid-cols-[340px_1fr]">
			<Paper className="min-h-[220px] overflow-hidden p-5 md:min-h-[260px] md:p-6">
				<div className="border-b border-paper-border pb-3 text-center">
					<p className="text-xs uppercase tracking-[0.16em] text-ink-muted">
						{exam.className}
					</p>
					<h2 className="mt-2 text-2xl font-semibold leading-tight">{exam.title}</h2>
				</div>
				<ol className="mt-5 space-y-3 text-sm leading-6 text-ink">
					{exam.topics.slice(0, 3).map((topic, index) => (
						<li key={topic}>
							<strong>{index + 1}.</strong> {topic}
						</li>
					))}
				</ol>
			</Paper>
			<div className="flex flex-col justify-center">
				<p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
					Ready to practice
				</p>
				<h2 className="mt-3 text-2xl font-semibold md:text-3xl">{exam.title}</h2>
				<p className="mt-3 max-w-xl text-sm leading-6 text-muted">
					Your exam artifact is ready. Work it like a real exam first, then upload your
					attempt and review the answer key.
				</p>
				<ol className="mt-5 grid gap-2 md:mt-6 md:gap-3">
					<li className="rounded-lg border border-glass-border bg-background/40 p-3 md:p-4">
						<div className="flex gap-3">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-sm font-semibold text-secondary">
								1
							</span>
							<div>
								<p className="font-semibold">Download the practice PDF</p>
								<p className="mt-1 text-sm leading-6 text-muted">
									Print it or work from the student copy.
								</p>
								<ButtonLink
									href={`/api/exams/${exam.id}/download?type=exam`}
									variant="primary"
									className="mt-3"
								>
									<Download aria-hidden="true" size={18} />
									Download exam
								</ButtonLink>
							</div>
						</div>
					</li>
					<li className="rounded-lg border border-glass-border bg-background/40 p-3 md:p-4">
						<div className="flex gap-3">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-sm font-semibold text-secondary">
								2
							</span>
							<div>
								<p className="font-semibold">Upload your finished attempt</p>
								<p className="mt-1 text-sm leading-6 text-muted">
									Get grading after you complete the exam.
								</p>
								<ButtonLink
									href={`/exams/${exam.id}`}
									variant="secondary"
									className="mt-3"
								>
									<UploadCloud aria-hidden="true" size={18} />
									Upload attempt
								</ButtonLink>
							</div>
						</div>
					</li>
					<li className="rounded-lg border border-glass-border bg-background/40 p-3 md:p-4">
						<div className="flex gap-3">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-sm font-semibold text-secondary">
								3
							</span>
							<div>
								<p className="font-semibold">Review the answer key</p>
								<p className="mt-1 text-sm leading-6 text-muted">
									Check solutions after the practice round.
								</p>
								<ButtonLink
									href={`/api/exams/${exam.id}/download?type=answer`}
									variant="secondary"
									className="mt-3"
								>
									<KeyRound aria-hidden="true" size={18} />
									Answer key
								</ButtonLink>
							</div>
						</div>
					</li>
				</ol>
			</div>
		</GlassPanel>
	);
}

function FirstExamPanel() {
	return (
		<GlassPanel className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
			<div>
				<p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
					Start here
				</p>
				<h2 className="mt-3 text-3xl font-semibold">
					Build your first exam from real course material
				</h2>
				<p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
					Use typed topics for the fastest start, or upload the slides and notes you want
					represented. The next screen shows the source controls before any credits are
					reserved.
				</p>
				<div className="mt-6 grid gap-4 border-t border-glass-border pt-5 sm:grid-cols-3">
					{[
						{ title: "Add sources", body: "Files, links, classes, or typed topics." },
						{ title: "Confirm scope", body: "Review topics before generation." },
						{ title: "Download PDF", body: "Practice from a formal exam sheet." },
					].map((step) => (
						<div key={step.title}>
							<CheckCircle2 aria-hidden="true" className="text-secondary" size={18} />
							<h3 className="mt-3 font-semibold">{step.title}</h3>
							<p className="mt-1 text-sm leading-5 text-muted">{step.body}</p>
						</div>
					))}
				</div>
				<ButtonLink href="/exams/new" variant="primary" className="mt-6">
					<UploadCloud aria-hidden="true" size={18} />
					Choose sources
				</ButtonLink>
			</div>
			<Paper className="p-6">
				<p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
					Practice Exam
				</p>
				<h3 className="mt-3 text-2xl font-semibold">First generated PDF</h3>
				<div className="mt-5 grid grid-cols-2 gap-4 text-xs text-ink-muted">
					<div className="border-b border-paper-border pb-2">Name</div>
					<div className="border-b border-paper-border pb-2">Date</div>
				</div>
				<ol className="mt-6 space-y-5 text-sm leading-6 text-ink">
					<li>
						<strong>1.</strong> Explain the main concept in your own words.
						<div className="mt-3 space-y-2">
							<div className="h-px bg-paper-border" />
							<div className="h-px bg-paper-border" />
						</div>
					</li>
					<li>
						<strong>2.</strong> Apply the method to a representative problem.
						<div className="mt-3 space-y-2">
							<div className="h-px bg-paper-border" />
							<div className="h-px bg-paper-border" />
						</div>
					</li>
				</ol>
			</Paper>
		</GlassPanel>
	);
}

function MetricCard({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof Coins;
	label: string;
	value: string;
}) {
	return (
		<GlassPanel className="p-4 md:p-5">
			<Icon aria-hidden="true" className="text-secondary" size={20} />
			<p className="mt-3 text-xs leading-5 text-muted md:text-sm">{label}</p>
			<p className="mt-1 text-2xl font-semibold md:text-3xl">{value}</p>
		</GlassPanel>
	);
}
