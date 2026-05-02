import { redirect } from "next/navigation";
import { ClassForm } from "@/components/class/class-form";
import { AppShell } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";

export default async function NewClassPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	return (
		<AppShell active="classes" unreadNotificationCount={user.unreadNotificationCount}>
			<div className="max-w-3xl space-y-8">
				<SectionHeader title="Add a class">
					<p>Education level sets the baseline difficulty for generated exams.</p>
				</SectionHeader>
				<GlassPanel className="p-6">
					<ClassForm />
				</GlassPanel>
			</div>
		</AppShell>
	);
}
