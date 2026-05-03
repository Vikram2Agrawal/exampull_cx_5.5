"use client";

import { Bug, CreditCard, LifeBuoy } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const reasons = [
	{ value: "refund", label: "Refund request", icon: CreditCard },
	{ value: "bug", label: "Bug report", icon: Bug },
	{ value: "general", label: "General help", icon: LifeBuoy },
] as const;

type SupportKind = (typeof reasons)[number]["value"];

export function SupportForm() {
	const [kind, setKind] = useState<SupportKind>("refund");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function submit() {
		startTransition(async () => {
			try {
				if (!title.trim() || !body.trim()) {
					throw new Error("Add a subject and a short description.");
				}

				const response = await fetch("/api/feedback", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						kind,
						title,
						body,
						source: "support_page",
						visibility: "private",
					}),
				});
				const result = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(result.error ?? "Support request failed.");
				}

				setTitle("");
				setBody("");
				setStatus("Support request sent.");
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Support request failed.");
			}
		});
	}

	return (
		<div>
			<fieldset className="grid gap-3">
				<legend className="sr-only">Support request type</legend>
				{reasons.map((reason) => {
					const Icon = reason.icon;

					return (
						<button
							key={reason.value}
							type="button"
							aria-pressed={kind === reason.value}
							className={cn(
								"flex min-h-12 items-center gap-3 rounded-lg border border-glass-border bg-background/40 px-3 text-left text-sm hover:bg-glass",
								kind === reason.value ? "border-secondary bg-glass-strong" : "",
							)}
							onClick={() => setKind(reason.value)}
						>
							<Icon aria-hidden="true" className="text-secondary" size={18} />
							{reason.label}
						</button>
					);
				})}
			</fieldset>
			<label className="mt-5 block text-sm font-medium" htmlFor="support-subject">
				Subject
				<input
					id="support-subject"
					className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
					placeholder="Payment question, upload issue, exam feedback"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
				/>
			</label>
			<label className="mt-3 block text-sm font-medium" htmlFor="support-description">
				What should we know?
				<textarea
					id="support-description"
					className="mt-2 min-h-32 w-full rounded-lg border border-glass-border bg-background/70 p-3 outline-none focus:ring-2 focus:ring-brand"
					placeholder="Include the class, exam title, or file name if it helps us find the issue."
					value={body}
					onChange={(event) => setBody(event.target.value)}
				/>
			</label>
			<Button
				type="button"
				variant="primary"
				className="mt-4"
				disabled={isPending}
				onClick={submit}
			>
				Send request
			</Button>
			{status ? (
				<p
					className="mt-3 rounded-lg bg-glass p-3 text-sm text-muted"
					role={status.toLowerCase().includes("failed") ? "alert" : "status"}
				>
					{status}
				</p>
			) : null}
		</div>
	);
}
