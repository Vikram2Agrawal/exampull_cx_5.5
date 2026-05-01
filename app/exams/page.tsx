import { Search } from "lucide-react";
import { redirect } from "next/navigation";
import { ExamCard } from "@/components/exam/exam-card";
import { AppShell } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserExams } from "@/lib/exams/data";

export default async function ExamsPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	const exams = await listUserExams(user.uid);

	return (
		<AppShell active="exams">
			<div className="space-y-8">
				<div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
					<SectionHeader title="Exam library">
						<p>
							Search, bookmark, archive, clone, download, grade, and share generated
							exams.
						</p>
					</SectionHeader>
					<ButtonLink href="/exams/new" variant="primary">
						New exam
					</ButtonLink>
				</div>
				<GlassPanel className="p-4">
					<div className="flex flex-col gap-3 md:flex-row">
						<label className="relative flex-1">
							<Search
								aria-hidden="true"
								className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
								size={18}
							/>
							<input
								className="h-11 w-full rounded-lg border border-glass-border bg-background/70 pl-10 pr-3 outline-none focus:ring-2 focus:ring-brand"
								placeholder="Search title, topic, or class"
							/>
						</label>
						<select className="h-11 rounded-lg border border-glass-border bg-background/70 px-3">
							<option>All statuses</option>
							<option>Complete</option>
							<option>Generating</option>
							<option>Reported</option>
						</select>
						<select className="h-11 rounded-lg border border-glass-border bg-background/70 px-3">
							<option>All classes</option>
							<option>MATH 301</option>
							<option>CHEM 242</option>
						</select>
					</div>
				</GlassPanel>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{exams.length > 0 ? (
						exams.map((exam) => <ExamCard key={exam.id} exam={exam} />)
					) : (
						<GlassPanel className="p-6 md:col-span-2 xl:col-span-3">
							<h2 className="text-xl font-semibold">No exams in the library</h2>
							<p className="mt-2 text-sm text-muted">
								Generated exams appear here with PDFs, attempts, ratings, reports,
								and share links.
							</p>
						</GlassPanel>
					)}
				</div>
			</div>
		</AppShell>
	);
}
