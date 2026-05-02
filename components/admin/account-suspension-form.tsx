"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAdminCsrfToken } from "@/components/admin/admin-csrf";
import { Button } from "@/components/ui/button";

export function AccountSuspensionForm() {
	const csrfToken = useAdminCsrfToken();
	const router = useRouter();
	const [userId, setUserId] = useState("");
	const [action, setAction] = useState<"suspend" | "unsuspend">("suspend");
	const [reason, setReason] = useState("");
	const [reauthPassword, setReauthPassword] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function submit() {
		startTransition(async () => {
			try {
				const response = await fetch(`/api/admin/users/${userId}/suspension`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-admin-csrf-token": csrfToken,
						"x-admin-reauth-password": reauthPassword,
					},
					body: JSON.stringify({
						action,
						reason,
					}),
				});
				const body = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(body.error ?? "Suspension update failed.");
				}

				setStatus(action === "suspend" ? "Account suspended." : "Account reinstated.");
				setReauthPassword("");
				router.refresh();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Suspension update failed.");
			}
		});
	}

	return (
		<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
			<h2 className="font-semibold">Account suspension</h2>
			<div className="mt-4 grid gap-3 lg:grid-cols-[1fr_150px_1fr_1fr_auto]">
				<input
					aria-label="Suspension user ID"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="User ID"
					value={userId}
					onChange={(event) => setUserId(event.target.value)}
				/>
				<select
					aria-label="Suspension action"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					value={action}
					onChange={(event) =>
						setAction(event.target.value === "unsuspend" ? "unsuspend" : "suspend")
					}
				>
					<option value="suspend">Suspend</option>
					<option value="unsuspend">Unsuspend</option>
				</select>
				<input
					aria-label="Suspension reason"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Reason"
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<input
					aria-label="Suspension re-auth password"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Re-auth password"
					type="password"
					value={reauthPassword}
					onChange={(event) => setReauthPassword(event.target.value)}
				/>
				<Button
					type="button"
					disabled={isPending || !userId || !reason || !reauthPassword}
					onClick={submit}
				>
					Apply
				</Button>
			</div>
			{status ? (
				<p className="mt-3 text-sm text-slate-500" role="status">
					{status}
				</p>
			) : null}
		</section>
	);
}
