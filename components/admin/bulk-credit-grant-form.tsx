"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminCsrfToken } from "@/components/admin/admin-csrf";

type BulkPreview = {
	previewId: string;
	recipientCount: number;
	totalCredits: number;
	sample: Array<{ userId: string; email: string; tier: string; credits: number }>;
};

export function BulkCreditGrantForm() {
	const csrfToken = useAdminCsrfToken();
	const router = useRouter();
	const [tier, setTier] = useState("any");
	const [testAccounts, setTestAccounts] = useState("exclude");
	const [emailContains, setEmailContains] = useState("");
	const [limit, setLimit] = useState("100");
	const [amount, setAmount] = useState("20");
	const [reason, setReason] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [reauthPassword, setReauthPassword] = useState("");
	const [preview, setPreview] = useState<BulkPreview | null>(null);
	const [status, setStatus] = useState("");
	const [pending, setPending] = useState(false);

	function requestBody(mode: "preview" | "execute") {
		return {
			mode,
			audience: {
				tier,
				testAccounts,
				emailContains: emailContains.trim() || null,
				limit: Number.parseInt(limit, 10),
			},
			amount: Number.parseInt(amount, 10),
			reason,
			expiresAt: expiresAt || null,
			previewId: preview?.previewId,
		};
	}

	async function submit(mode: "preview" | "execute") {
		setPending(true);
		setStatus("");

		try {
			const response = await fetch("/api/admin/credits/bulk", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-csrf-token": csrfToken,
					...(mode === "execute" ? { "x-admin-reauth-password": reauthPassword } : {}),
				},
				body: JSON.stringify(requestBody(mode)),
			});
			const body = (await response.json()) as BulkPreview & {
				error?: string;
				grantId?: string;
				recipientCount?: number;
				totalCredits?: number;
			};

			if (!response.ok) {
				throw new Error(body.error ?? "Bulk credit grant failed.");
			}

			if (mode === "preview") {
				setPreview(body);
				setStatus("Dry run ready.");
			} else {
				setStatus(
					`Bulk grant recorded for ${(body.recipientCount ?? 0).toString()} recipient(s).`,
				);
				setPreview(null);
				setReauthPassword("");
				router.refresh();
			}
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Bulk credit grant failed.");
		} finally {
			setPending(false);
		}
	}

	return (
		<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
			<h2 className="font-semibold">Bulk credit grant</h2>
			<div className="mt-4 grid gap-3 lg:grid-cols-[120px_150px_1fr_100px_100px_150px]">
				<select
					aria-label="Bulk grant tier"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					value={tier}
					onChange={(event) => {
						setTier(event.target.value);
						setPreview(null);
					}}
				>
					<option value="any">Any tier</option>
					<option value="free">Free</option>
					<option value="scholar">Scholar</option>
					<option value="guru">Guru</option>
				</select>
				<select
					aria-label="Bulk grant test accounts"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					value={testAccounts}
					onChange={(event) => {
						setTestAccounts(event.target.value);
						setPreview(null);
					}}
				>
					<option value="exclude">Organic only</option>
					<option value="only">Test only</option>
					<option value="include">Include test</option>
				</select>
				<input
					aria-label="Bulk grant email filter"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Email contains"
					value={emailContains}
					onChange={(event) => {
						setEmailContains(event.target.value);
						setPreview(null);
					}}
				/>
				<input
					aria-label="Bulk grant recipient limit"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					min="1"
					type="number"
					value={limit}
					onChange={(event) => {
						setLimit(event.target.value);
						setPreview(null);
					}}
				/>
				<input
					aria-label="Bulk grant amount"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					min="1"
					type="number"
					value={amount}
					onChange={(event) => {
						setAmount(event.target.value);
						setPreview(null);
					}}
				/>
				<input
					aria-label="Bulk grant expires on"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					type="date"
					value={expiresAt}
					onChange={(event) => {
						setExpiresAt(event.target.value);
						setPreview(null);
					}}
				/>
			</div>
			<div className="mt-3 grid gap-3 lg:grid-cols-[1fr_220px_auto_auto]">
				<input
					aria-label="Bulk grant reason"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Reason"
					value={reason}
					onChange={(event) => {
						setReason(event.target.value);
						setPreview(null);
					}}
				/>
				<input
					aria-label="Bulk grant re-auth password"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Re-auth password"
					type="password"
					value={reauthPassword}
					onChange={(event) => setReauthPassword(event.target.value)}
				/>
				<button
					className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
					disabled={pending || !reason}
					type="button"
					onClick={() => void submit("preview")}
				>
					Dry run
				</button>
				<button
					className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
					disabled={pending || !preview || !reauthPassword}
					type="button"
					onClick={() => void submit("execute")}
				>
					Execute
				</button>
			</div>
			{preview ? (
				<div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
					<p className="font-medium">
						{preview.recipientCount.toString()} recipient(s),{" "}
						{preview.totalCredits.toString()} total credits.
					</p>
					<ul className="mt-2 space-y-1 text-xs text-slate-500">
						{preview.sample.map((recipient) => (
							<li key={recipient.userId}>
								{recipient.email} · {recipient.tier} ·{" "}
								{recipient.credits.toString()} credits
							</li>
						))}
					</ul>
				</div>
			) : null}
			{status ? (
				<p className="mt-3 text-sm text-slate-500" role="status">
					{status}
				</p>
			) : null}
		</section>
	);
}
