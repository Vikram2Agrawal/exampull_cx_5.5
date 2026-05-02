"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAdminCsrfToken } from "@/components/admin/admin-csrf";
import { Button } from "@/components/ui/button";

export function CreditGrantForm() {
	const csrfToken = useAdminCsrfToken();
	const router = useRouter();
	const [userId, setUserId] = useState("");
	const [amount, setAmount] = useState("20");
	const [reason, setReason] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function submit() {
		startTransition(async () => {
			try {
				const parsedAmount = Number.parseInt(amount, 10);
				const response = await fetch(`/api/admin/users/${userId}/credits`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-admin-csrf-token": csrfToken,
					},
					body: JSON.stringify({ amount: parsedAmount, reason }),
				});
				const body = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(body.error ?? "Credit grant failed.");
				}

				setStatus("Credit grant recorded.");
				router.refresh();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Credit grant failed.");
			}
		});
	}

	return (
		<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
			<h2 className="font-semibold">Manual credit grant</h2>
			<div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_1fr_auto]">
				<input
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="User ID"
					value={userId}
					onChange={(event) => setUserId(event.target.value)}
				/>
				<input
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Amount"
					value={amount}
					onChange={(event) => setAmount(event.target.value)}
				/>
				<input
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Reason"
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<Button type="button" disabled={isPending || !userId || !reason} onClick={submit}>
					Grant
				</Button>
			</div>
			{status ? <p className="mt-3 text-sm text-slate-500">{status}</p> : null}
		</section>
	);
}
