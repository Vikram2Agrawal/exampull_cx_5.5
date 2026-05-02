"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAdminCsrfToken } from "@/components/admin/admin-csrf";
import { Button } from "@/components/ui/button";

const actions = [
	{ value: "mark_reviewed", label: "Mark reviewed" },
	{ value: "flag", label: "Flag" },
	{ value: "grant_scholar", label: "Grant Scholar" },
	{ value: "grant_guru", label: "Grant Guru" },
	{ value: "revoke_scholar", label: "Revoke Scholar" },
	{ value: "revoke_guru", label: "Revoke Guru" },
] as const;

function requiresReauth(action: (typeof actions)[number]["value"]) {
	return action.startsWith("grant_") || action.startsWith("revoke_");
}

export function ReferralOverrideControls({ referralId }: { referralId: string }) {
	const csrfToken = useAdminCsrfToken();
	const router = useRouter();
	const [action, setAction] = useState<(typeof actions)[number]["value"]>("mark_reviewed");
	const [reason, setReason] = useState("");
	const [reauthPassword, setReauthPassword] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();
	const needsReauth = requiresReauth(action);

	function submit() {
		startTransition(async () => {
			try {
				const response = await fetch(`/api/admin/referrals/${referralId}/override`, {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						"x-admin-csrf-token": csrfToken,
						"x-admin-reauth-password": reauthPassword,
					},
					body: JSON.stringify({ action, reason }),
				});
				const body = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(body.error ?? "Referral override failed.");
				}

				setStatus("Override recorded.");
				setReason("");
				setReauthPassword("");
				router.refresh();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Referral override failed.");
			}
		});
	}

	return (
		<div className="grid min-w-[320px] gap-2">
			<div className="grid gap-2 sm:grid-cols-[140px_1fr_1fr_auto]">
				<select
					className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
					disabled={isPending}
					value={action}
					onChange={(event) =>
						setAction(event.target.value as (typeof actions)[number]["value"])
					}
				>
					{actions.map((item) => (
						<option key={item.value} value={item.value}>
							{item.label}
						</option>
					))}
				</select>
				<input
					className="h-9 rounded-md border border-slate-200 px-2 text-sm"
					placeholder="Review reason"
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<input
					className="h-9 rounded-md border border-slate-200 px-2 text-sm"
					placeholder={needsReauth ? "Re-auth password" : "Re-auth optional"}
					type="password"
					value={reauthPassword}
					onChange={(event) => setReauthPassword(event.target.value)}
				/>
				<Button
					type="button"
					disabled={
						isPending || reason.trim().length < 4 || (needsReauth && !reauthPassword)
					}
					onClick={submit}
				>
					Apply
				</Button>
			</div>
			{status ? <p className="text-xs text-slate-500">{status}</p> : null}
		</div>
	);
}
