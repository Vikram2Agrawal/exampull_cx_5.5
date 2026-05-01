import { ArrowRight, BookOpen, Clock, Coins, FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { ExamCard } from "@/components/exam/exam-card";
import { AppShell } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
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
		<AppShell active="dashboard">
			<div className="space-y-8">
				<div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
					<SectionHeader title="Your exam atelier">
						<p>
							Start from materials, clone a prior exam, or jump back into an active
							generation.
						</p>
					</SectionHeader>
					<ButtonLink href="/exams/new" variant="primary">
						Create exam
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
						label="Generated exams"
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
				<section>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-2xl font-semibold">Recent exams</h2>
						<a href="/exams" className="text-sm text-secondary">
							View library
						</a>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{exams.length > 0 ? (
							exams.map((exam) => <ExamCard key={exam.id} exam={exam} />)
						) : (
							<GlassPanel className="p-6 md:col-span-3">
								<h3 className="text-lg font-semibold">No generated exams yet</h3>
								<p className="mt-2 text-sm text-muted">
									Create your first manual-topics exam, then add class materials
									and style guides as the library grows.
								</p>
							</GlassPanel>
						)}
					</div>
				</section>
			</div>
		</AppShell>
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
