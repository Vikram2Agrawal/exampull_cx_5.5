"use client";

import { Bell, CheckCircle2, CreditCard, FileText, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { UserNotification } from "@/lib/user/data";

const iconByKind = {
	exam: FileText,
	grading: CheckCircle2,
	billing: CreditCard,
	feedback: MessageSquare,
	system: Bell,
} as const;

function iconForKind(kind: string) {
	return iconByKind[kind as keyof typeof iconByKind] ?? Bell;
}

export function NotificationList({ notifications }: { notifications: UserNotification[] }) {
	const router = useRouter();
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function markRead() {
		startTransition(async () => {
			try {
				const response = await fetch("/api/notifications", { method: "PATCH" });
				const body = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(body.error ?? "Unable to mark notifications read.");
				}

				setStatus("Notifications marked read.");
				router.refresh();
			} catch (error) {
				setStatus(
					error instanceof Error ? error.message : "Unable to mark notifications read.",
				);
			}
		});
	}

	return (
		<div className="space-y-6">
			<div className="divide-y divide-glass-border rounded-lg border border-glass-border bg-glass">
				{notifications.length > 0 ? (
					notifications.map((notification) => {
						const Icon = iconForKind(notification.kind);
						const content = (
							<div key={notification.id} className="flex gap-4 p-5">
								<div className="flex h-11 w-11 items-center justify-center rounded-lg bg-glass">
									<Icon aria-hidden="true" className="text-secondary" size={20} />
								</div>
								<div className="flex-1">
									<h2 className="font-semibold">{notification.title}</h2>
									<p className="mt-1 text-sm text-muted">{notification.body}</p>
								</div>
								{notification.read ? null : (
									<Bell aria-hidden="true" className="text-premium" size={18} />
								)}
							</div>
						);

						return notification.href ? (
							<a key={notification.id} href={notification.href} className="block">
								{content}
							</a>
						) : (
							<div key={notification.id}>{content}</div>
						);
					})
				) : (
					<div className="p-5">
						<h2 className="font-semibold">No notifications</h2>
						<p className="mt-1 text-sm text-muted">
							Exam, grading, billing, referral, share, and account events will appear
							here.
						</p>
					</div>
				)}
			</div>
			<div className="flex items-center gap-3">
				<Button
					type="button"
					disabled={isPending || notifications.length === 0}
					onClick={markRead}
				>
					Mark all as read
				</Button>
				{status ? <p className="text-sm text-muted">{status}</p> : null}
			</div>
		</div>
	);
}
