"use client";

import {
	Bell,
	Check,
	CheckCircle2,
	CreditCard,
	FileText,
	MessageSquare,
	Network,
	Share2,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { UserNotification } from "@/lib/user/data";

const iconByKind = {
	exam: FileText,
	grading: CheckCircle2,
	billing: CreditCard,
	feedback: MessageSquare,
	referral: Network,
	share: Share2,
	account: ShieldCheck,
	answer: CheckCircle2,
	system: Bell,
} as const;

function iconForKind(kind: string) {
	return iconByKind[kind as keyof typeof iconByKind] ?? Bell;
}

export function NotificationList({ notifications }: { notifications: UserNotification[] }) {
	const router = useRouter();
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function updateNotification({
		path,
		method,
		success,
		redirectTo,
	}: {
		path: string;
		method: "PATCH" | "DELETE";
		success: string;
		redirectTo?: string | null;
	}) {
		startTransition(async () => {
			try {
				const response = await fetch(path, { method });
				const body = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(body.error ?? "Notification update failed.");
				}

				setStatus(success);
				if (redirectTo) {
					router.push(redirectTo);
				} else {
					router.refresh();
				}
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Notification update failed.");
			}
		});
	}

	return (
		<div className="space-y-6">
			<div className="divide-y divide-glass-border rounded-lg border border-glass-border bg-glass">
				{notifications.length > 0 ? (
					notifications.map((notification) => {
						const Icon = iconForKind(notification.kind);
						const unread = !notification.read;

						return (
							<div key={notification.id} className="flex gap-4 p-5">
								<div className="flex h-11 w-11 items-center justify-center rounded-lg bg-glass">
									<Icon aria-hidden="true" className="text-secondary" size={20} />
								</div>
								<button
									type="button"
									className="flex-1 text-left"
									disabled={isPending}
									onClick={() =>
										updateNotification({
											path: `/api/notifications/${notification.id}`,
											method: "PATCH",
											success: "Notification marked read.",
											redirectTo: notification.href,
										})
									}
								>
									<h2 className="font-semibold">{notification.title}</h2>
									<p className="mt-1 text-sm text-muted">{notification.body}</p>
								</button>
								<div className="flex items-start gap-1">
									{unread ? (
										<Bell
											aria-hidden="true"
											className="mt-2 text-premium"
											size={18}
										/>
									) : null}
									{unread ? (
										<Button
											type="button"
											aria-label={`Mark ${notification.title} as read`}
											size="icon"
											variant="ghost"
											disabled={isPending}
											onClick={() =>
												updateNotification({
													path: `/api/notifications/${notification.id}`,
													method: "PATCH",
													success: "Notification marked read.",
												})
											}
										>
											<Check aria-hidden="true" size={17} />
										</Button>
									) : null}
									<Button
										type="button"
										aria-label={`Delete ${notification.title}`}
										size="icon"
										variant="ghost"
										disabled={isPending}
										onClick={() =>
											updateNotification({
												path: `/api/notifications/${notification.id}`,
												method: "DELETE",
												success: "Notification deleted.",
											})
										}
									>
										<Trash2 aria-hidden="true" size={17} />
									</Button>
								</div>
							</div>
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
					onClick={() =>
						updateNotification({
							path: "/api/notifications",
							method: "PATCH",
							success: "Notifications marked read.",
						})
					}
				>
					Mark all as read
				</Button>
				<Button
					type="button"
					variant="ghost"
					disabled={isPending || notifications.length === 0}
					onClick={() =>
						updateNotification({
							path: "/api/notifications",
							method: "DELETE",
							success: "Notifications cleared.",
						})
					}
				>
					Clear all
				</Button>
				{status ? <p className="text-sm text-muted">{status}</p> : null}
			</div>
		</div>
	);
}
