"use client";

import { Flag } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type ShareReportFormProps = {
	shareId: string;
};

async function readJson(response: Response) {
	const body = (await response.json().catch(() => ({}))) as { error?: string };

	if (!response.ok) {
		throw new Error(body.error ?? "Share report failed.");
	}

	return body;
}

export function ShareReportForm({ shareId }: ShareReportFormProps) {
	const [expanded, setExpanded] = useState(false);
	const [body, setBody] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function submitReport() {
		startTransition(async () => {
			try {
				await readJson(
					await fetch(`/api/share/${shareId}/report`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ body }),
					}),
				);
				setBody("");
				setStatus("Thanks. The creator has been notified.");
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Share report failed.");
			}
		});
	}

	if (!expanded) {
		return (
			<button
				type="button"
				className="mt-4 inline-flex items-center gap-2 text-sm text-secondary"
				onClick={() => setExpanded(true)}
			>
				<Flag aria-hidden="true" size={16} />
				Something wrong with this exam?
			</button>
		);
	}

	return (
		<div className="mt-4 space-y-3">
			<label className="block text-sm font-medium" htmlFor="share-report-body">
				What looked wrong?
			</label>
			<textarea
				id="share-report-body"
				value={body}
				onChange={(event) => setBody(event.target.value)}
				className="min-h-24 w-full rounded-lg border border-glass-border bg-background/70 p-3 text-sm outline-none focus:ring-2 focus:ring-brand"
				maxLength={1200}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<Button type="button" size="sm" onClick={submitReport} disabled={isPending}>
					<Flag aria-hidden="true" size={16} />
					Flag shared exam
				</Button>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={() => setExpanded(false)}
					disabled={isPending}
				>
					Cancel
				</Button>
			</div>
			{status ? (
				<p className="text-sm text-muted" role="status">
					{status}
				</p>
			) : null}
		</div>
	);
}
