"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminCsrfToken } from "@/components/admin/admin-csrf";

export function RefundActionForm({
	sourceCollection,
	sourceId,
	defaultCredits,
}: {
	sourceCollection: "feedback" | "abuseReports";
	sourceId: string;
	defaultCredits: number;
}) {
	const csrfToken = useAdminCsrfToken();
	const router = useRouter();
	const [status, setStatus] = useState("");
	const [pending, setPending] = useState(false);

	return (
		<form
			className="min-w-[260px] space-y-2"
			onSubmit={async (event) => {
				event.preventDefault();
				setPending(true);
				setStatus("");
				const form = new FormData(event.currentTarget);
				const action = String(form.get("action") ?? "approve");
				const creditAmount = Number(form.get("creditAmount") ?? 0);
				const cashAmountCents = Math.round(Number(form.get("cashDollars") ?? 0) * 100);
				const note = String(form.get("note") ?? "");
				const reauth = String(form.get("reauth") ?? "");

				try {
					const response = await fetch("/api/admin/refunds/action", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"x-admin-csrf-token": csrfToken,
							"x-admin-reauth-password": reauth,
						},
						body: JSON.stringify({
							sourceCollection,
							sourceId,
							action,
							creditAmount,
							cashAmountCents,
							note,
						}),
					});
					const body = (await response.json()) as { error?: string; status?: string };

					if (!response.ok) {
						throw new Error(body.error ?? "Refund action failed.");
					}

					setStatus(
						body.status === "approved" ? "Refund approved." : "Refund action recorded.",
					);
					router.refresh();
				} catch (error) {
					setStatus(error instanceof Error ? error.message : "Refund action failed.");
				} finally {
					setPending(false);
				}
			}}
		>
			<div className="grid grid-cols-2 gap-2">
				<select
					aria-label="Refund action"
					className="rounded-md border border-slate-200 px-2 py-2 text-sm"
					name="action"
				>
					<option value="approve">Approve</option>
					<option value="decline">Decline</option>
					<option value="escalate">Escalate</option>
				</select>
				<input
					aria-label="Credit refund amount"
					className="rounded-md border border-slate-200 px-2 py-2 text-sm"
					defaultValue={defaultCredits}
					min="0"
					name="creditAmount"
					placeholder="Credits"
					type="number"
				/>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<input
					aria-label="Cash refund dollars"
					className="rounded-md border border-slate-200 px-2 py-2 text-sm"
					min="0"
					name="cashDollars"
					placeholder="Cash $"
					step="0.01"
					type="number"
				/>
				<input
					aria-label="Admin re-auth password"
					className="rounded-md border border-slate-200 px-2 py-2 text-sm"
					name="reauth"
					placeholder="Re-auth"
					type="password"
				/>
			</div>
			<textarea
				aria-label="Refund note"
				className="min-h-16 w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
				name="note"
				placeholder="Required note"
			/>
			<button
				className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
				disabled={pending}
				type="submit"
			>
				{pending ? "Recording..." : "Record"}
			</button>
			{status ? (
				<p className="text-xs text-slate-500" role="status">
					{status}
				</p>
			) : null}
		</form>
	);
}
