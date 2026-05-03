import { redirect } from "next/navigation";
import { NewExamForm } from "@/components/exam/new-exam-form";
import { AppShell } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, Paper, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listClassMaterials, listUserClasses } from "@/lib/classes/data";
import { listUserExams } from "@/lib/exams/data";

export default async function NewExamPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	if (user.accountStatus === "suspended") {
		return (
			<AppShell
				active="exams"
				unreadNotificationCount={user.unreadNotificationCount}
				theme={user.theme}
			>
				<div className="space-y-8">
					<SectionHeader title="Build a practice exam">
						<p>Your existing library stays available while generation is paused.</p>
					</SectionHeader>
					<GlassPanel className="p-6">
						<h2 className="text-2xl font-semibold">Exam generation paused</h2>
						<p className="mt-2 max-w-2xl text-sm text-muted">
							Your account can still view and download existing exams, but new exam
							generation is disabled while an operator reviews the account.
						</p>
						<div className="mt-5 flex flex-wrap gap-3">
							<ButtonLink href="/exams">View library</ButtonLink>
							<ButtonLink href="/support" variant="ghost">
								Contact support
							</ButtonLink>
						</div>
					</GlassPanel>
				</div>
			</AppShell>
		);
	}

	const [classes, priorExams] = await Promise.all([
		listUserClasses(user.uid),
		listUserExams(user.uid, { limit: 2, includeArchived: true }),
	]);
	const sourceClasses = await Promise.all(
		classes
			.filter((course) => !course.archived)
			.map(async (course) => ({
				...course,
				materials: await listClassMaterials(user.uid, course.id),
			})),
	);

	return (
		<AppShell
			active="exams"
			unreadNotificationCount={user.unreadNotificationCount}
			theme={user.theme}
		>
			<div className="space-y-8">
				<SectionHeader title="Build a practice exam">
					<p>
						Add your files or topics, review what ExamPull found, then choose the
						length. Credits are reserved only when you generate.
					</p>
				</SectionHeader>
				<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
					<NewExamForm
						tier={user.tier}
						credits={user.credits}
						boostAvailable={user.tier === "free" && !user.boostUsedAt}
						priorExamCount={priorExams.length}
						classes={sourceClasses}
					/>
					<aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
						<Paper className="p-6">
							<p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
								Output
							</p>
							<h2 className="mt-3 text-2xl font-semibold">A printable exam sheet</h2>
							<ol className="mt-6 space-y-4 text-sm leading-6 text-ink">
								<li>
									<strong>1.</strong> Source material defines what the exam should
									cover.
								</li>
								<li>
									<strong>2.</strong> Topics keep the scope narrow enough to be
									useful.
								</li>
								<li>
									<strong>3.</strong> Length and mode set how much practice you
									get.
								</li>
							</ol>
							<div className="mt-6 space-y-2 border-t border-paper-border pt-4">
								<div className="h-px bg-paper-border" />
								<div className="h-px bg-paper-border" />
								<div className="h-px bg-paper-border" />
							</div>
						</Paper>
						<GlassPanel className="p-5">
							<h2 className="font-semibold">Before credits are reserved</h2>
							<p className="mt-2 text-sm leading-6 text-muted">
								Upload, type, edit, and refresh freely. Credits are reserved only
								after you press Generate.
							</p>
						</GlassPanel>
					</aside>
				</div>
			</div>
		</AppShell>
	);
}
