import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/site-nav";
import { NotificationList } from "@/components/notifications/notification-list";
import { SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserNotifications } from "@/lib/user/data";

export default async function NotificationsPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	const notifications = await listUserNotifications(user.uid);

	return (
		<AppShell
			active="alerts"
			unreadNotificationCount={user.unreadNotificationCount}
			theme={user.theme}
		>
			<div className="space-y-8">
				<SectionHeader title="Notifications">
					<p>
						Async exam, grading, billing, referral, share-link, and account events stay
						here.
					</p>
				</SectionHeader>
				<NotificationList notifications={notifications} />
			</div>
		</AppShell>
	);
}
