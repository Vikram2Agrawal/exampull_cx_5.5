import { redirect } from "next/navigation";
import { ExamLibrary } from "@/components/exam/exam-library";
import { AppShell } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserClasses } from "@/lib/classes/data";
import { listUserExams } from "@/lib/exams/data";

export default async function ExamsPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	const [exams, classes] = await Promise.all([
		listUserExams(user.uid, { limit: 100, includeArchived: true }),
		listUserClasses(user.uid),
	]);

	return (
		<AppShell active="exams" unreadNotificationCount={user.unreadNotificationCount}>
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
				<ExamLibrary initialExams={exams} classes={classes} />
			</div>
		</AppShell>
	);
}
