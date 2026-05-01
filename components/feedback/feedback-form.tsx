"use client";

import { Bug, Lightbulb, MessageSquare } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const kinds = [
	{ value: "feature", label: "Suggest a feature", icon: Lightbulb },
	{ value: "bug", label: "Report a bug", icon: Bug },
	{ value: "general", label: "General feedback", icon: MessageSquare },
] as const;

type FeedbackKind = (typeof kinds)[number]["value"];

export function FeedbackForm() {
	const [kind, setKind] = useState<FeedbackKind>("feature");
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
					body: JSON.stringify({ kind, title, body }),
				});
				const result = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(result.error ?? "Feedback submission failed.");
				}

				setTitle("");
				setBody("");
				setStatus("Feedback submitted.");
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Feedback submission failed.");
			}
		});
	}

	return (
		<div>
			<div className="grid gap-2">
				{kinds.map((tab) => {
					const Icon = tab.icon;

					return (
						<button
							key={tab.value}
							type="button"
							className={cn(
								"flex min-h-12 items-center gap-3 rounded-lg border border-glass-border bg-background/40 px-3 text-left text-sm hover:bg-glass",
								kind === tab.value ? "border-secondary bg-glass-strong" : "",
							)}
							onClick={() => setKind(tab.value)}
						>
							<Icon aria-hidden="true" className="text-secondary" size={18} />
							{tab.label}
						</button>
					);
				})}
			</div>
			<input
				className="mt-5 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
				placeholder="Title"
				value={title}
				onChange={(event) => setTitle(event.target.value)}
			/>
			<textarea
				className="mt-3 min-h-32 w-full rounded-lg border border-glass-border bg-background/70 p-3 outline-none focus:ring-2 focus:ring-brand"
				placeholder="What should change?"
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
				Submit
			</Button>
			{status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}
		</div>
	);
}
