import { redirect } from "next/navigation";
import { ClassForm } from "@/components/class/class-form";
import { AppShell } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";

export default async function NewClassPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-up");
	}

	return (
		<AppShell
			active="classes"
			unreadNotificationCount={user.unreadNotificationCount}
			theme={user.theme}
		>
			<div className="max-w-3xl space-y-8">
				<SectionHeader title="Add a class">
					<p>
						Create a reusable home for course files, style examples, and future practice
						exams.
					</p>
				</SectionHeader>
				<GlassPanel className="p-6">
					<ClassForm />
				</GlassPanel>
			</div>
		</AppShell>
	);
}
