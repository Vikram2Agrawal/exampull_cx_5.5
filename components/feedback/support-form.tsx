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
			<div className="grid gap-3">
				{reasons.map((reason) => {
					const Icon = reason.icon;

					return (
						<button
							key={reason.value}
							type="button"
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
			</div>
			<input
				className="mt-5 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
				placeholder="Subject"
				value={title}
				onChange={(event) => setTitle(event.target.value)}
			/>
			<textarea
				className="mt-3 min-h-32 w-full rounded-lg border border-glass-border bg-background/70 p-3 outline-none focus:ring-2 focus:ring-brand"
				placeholder="What should we know?"
				value={body}
				onChange={(event) => setBody(event.target.value)}
			/>
			<Button
				type="button"
				variant="primary"
				className="mt-4"
				disabled={isPending}
				onClick={submit}
			>
				Send request
			</Button>
			{status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}
		</div>
	);
}
