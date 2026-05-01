import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/site-nav";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";

export default async function SettingsPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	return (
		<AppShell active="settings">
			<div className="space-y-8">
				<SectionHeader title="Settings">
					<p>
						Manage profile, linked auth sources, billing, notifications, appearance,
						export, and deletion.
					</p>
				</SectionHeader>
				<SettingsPanel displayName={user.displayName} email={user.email} />
			</div>
		</AppShell>
	);
}
