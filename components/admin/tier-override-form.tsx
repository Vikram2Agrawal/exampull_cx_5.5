"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAdminCsrfToken } from "@/components/admin/admin-csrf";
import { Button } from "@/components/ui/button";

export function TierOverrideForm() {
	const csrfToken = useAdminCsrfToken();
	const router = useRouter();
	const [userId, setUserId] = useState("");
	const [tier, setTier] = useState("scholar");
	const [expiresAt, setExpiresAt] = useState("");
	const [reason, setReason] = useState("");
	const [reauthPassword, setReauthPassword] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function submit() {
		startTransition(async () => {
			try {
				const response = await fetch(`/api/admin/users/${userId}/tier`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-admin-csrf-token": csrfToken,
						"x-admin-reauth-password": reauthPassword,
					},
					body: JSON.stringify({
						tier,
						expiresAt: expiresAt || null,
						reason,
					}),
				});
				const body = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(body.error ?? "Tier override failed.");
				}

				setStatus("Tier override recorded.");
				setReauthPassword("");
				router.refresh();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Tier override failed.");
			}
		});
	}

	return (
		<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
			<h2 className="font-semibold">Tier override</h2>
			<div className="mt-4 grid gap-3 lg:grid-cols-[1fr_140px_160px_1fr_1fr_auto]">
				<input
					aria-label="Tier override user ID"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="User ID"
					value={userId}
					onChange={(event) => setUserId(event.target.value)}
				/>
				<select
					aria-label="Tier override tier"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					value={tier}
					onChange={(event) => setTier(event.target.value)}
				>
					<option value="free">Free</option>
					<option value="scholar">Scholar</option>
					<option value="guru">Guru</option>
				</select>
				<input
					aria-label="Tier override expires on"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					type="date"
					value={expiresAt}
					onChange={(event) => setExpiresAt(event.target.value)}
				/>
				<input
					aria-label="Tier override reason"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Reason"
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<input
					aria-label="Tier override re-auth password"
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
					Override
				</Button>
			</div>
			{status ? <p className="mt-3 text-sm text-slate-500">{status}</p> : null}
		</section>
	);
}
