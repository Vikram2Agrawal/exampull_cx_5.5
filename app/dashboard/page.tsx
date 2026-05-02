import {
	ArrowRight,
	BookOpen,
	CheckCircle2,
	Clock,
	Coins,
	FileText,
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
		redirect("/sign-in");
	}

	const [exams, classes] = await Promise.all([
		listUserExams(user.uid, 6),
		listUserClasses(user.uid),
	]);
	const activeExam = exams.find(
		(exam) => exam.status === "generating" || exam.status === "qa_in_progress",
	);

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
				<div className="grid gap-4 md:grid-cols-4">
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
					<MetricCard icon={Clock} label="Avg generation" value="1m 42s" />
				</div>
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
		<GlassPanel className="p-5">
			<Icon aria-hidden="true" className="text-secondary" size={20} />
			<p className="mt-4 text-sm text-muted">{label}</p>
			<p className="mt-1 text-3xl font-semibold">{value}</p>
		</GlassPanel>
	);
}
