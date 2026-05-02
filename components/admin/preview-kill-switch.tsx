"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAdminCsrfToken } from "@/components/admin/admin-csrf";
import { Button } from "@/components/ui/button";

export function PreviewKillSwitch({
	initialDisabled,
	initialMessage,
}: {
	initialDisabled: boolean;
	initialMessage: string;
}) {
	const csrfToken = useAdminCsrfToken();
	const router = useRouter();
	const [disabled, setDisabled] = useState(initialDisabled);
	const [message, setMessage] = useState(initialMessage);
	const [reason, setReason] = useState("");
	const [reauthPassword, setReauthPassword] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();
	const nextDisabled = !disabled;

	function submit() {
		startTransition(async () => {
			try {
				const response = await fetch("/api/admin/configuration/preview", {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						"x-admin-csrf-token": csrfToken,
						"x-admin-reauth-password": reauthPassword,
					},
					body: JSON.stringify({
						disabled: nextDisabled,
						message,
						reason,
					}),
				});
				const body = (await response.json().catch(() => ({}))) as {
					error?: string;
					previewGenerationDisabled?: boolean;
					previewDisabledMessage?: string;
				};

				if (!response.ok) {
					throw new Error(body.error ?? "Preview configuration failed.");
				}

				setDisabled(body.previewGenerationDisabled ?? nextDisabled);
				setMessage(body.previewDisabledMessage ?? message);
				setReason("");
				setReauthPassword("");
				setStatus("Preview configuration updated.");
				router.refresh();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Preview configuration failed.");
			}
		});
	}

	return (
		<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-semibold">Preview generation kill switch</h2>
					<p className="mt-1 text-sm text-slate-500">
						Current state:{" "}
						<span className={disabled ? "text-red-700" : "text-emerald-700"}>
							{disabled ? "disabled" : "enabled"}
						</span>
					</p>
				</div>
				<Button
					type="button"
					disabled={isPending || reason.trim().length < 4 || !reauthPassword}
					onClick={submit}
					variant={nextDisabled ? "secondary" : "primary"}
				>
					{nextDisabled ? "Disable preview" : "Enable preview"}
				</Button>
			</div>
			<div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_220px]">
				<input
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Operator reason"
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<input
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Paused-state message"
					value={message}
					onChange={(event) => setMessage(event.target.value)}
				/>
				<input
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Re-auth password"
					type="password"
					value={reauthPassword}
					onChange={(event) => setReauthPassword(event.target.value)}
				/>
			</div>
			{status ? <p className="mt-3 text-sm text-slate-500">{status}</p> : null}
		</section>
	);
}
