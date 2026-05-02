"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAdminCsrfToken } from "@/components/admin/admin-csrf";
import { Button } from "@/components/ui/button";

export function ExamRegenerateForm() {
	const csrfToken = useAdminCsrfToken();
	const router = useRouter();
	const [userId, setUserId] = useState("");
	const [examId, setExamId] = useState("");
	const [reason, setReason] = useState("");
	const [reauthPassword, setReauthPassword] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function submit() {
		startTransition(async () => {
			try {
				const response = await fetch(`/api/admin/exams/${userId}/${examId}/regenerate`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-admin-csrf-token": csrfToken,
						"x-admin-reauth-password": reauthPassword,
					},
					body: JSON.stringify({ reason }),
				});
				const body = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(body.error ?? "Regeneration failed.");
				}

				setStatus("Regeneration queued.");
				setReauthPassword("");
				router.refresh();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Regeneration failed.");
			}
		});
	}

	return (
		<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
			<h2 className="font-semibold">Force regenerate exam</h2>
			<div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
				<input
					aria-label="Regenerate user ID"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="User ID"
					value={userId}
					onChange={(event) => setUserId(event.target.value)}
				/>
				<input
					aria-label="Regenerate exam ID"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Exam ID"
					value={examId}
					onChange={(event) => setExamId(event.target.value)}
				/>
				<input
					aria-label="Regenerate reason"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Reason"
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<input
					aria-label="Regenerate re-auth password"
					className="h-10 rounded-md border border-slate-200 px-3 text-sm"
					placeholder="Re-auth password"
					type="password"
					value={reauthPassword}
					onChange={(event) => setReauthPassword(event.target.value)}
				/>
				<Button
					type="button"
					disabled={isPending || !userId || !examId || !reason || !reauthPassword}
					onClick={submit}
				>
					Regenerate
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
