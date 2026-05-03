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

export function FeedbackForm({
	source = "feedback_page",
	defaultKind = "feature",
	onSubmitted,
}: {
	source?: "feedback_page" | "in_app_widget" | "support_page" | "share_page";
	defaultKind?: FeedbackKind;
	onSubmitted?: () => void;
}) {
	const [kind, setKind] = useState<FeedbackKind>(defaultKind);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [visibility, setVisibility] = useState<"public" | "private">("public");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function submit() {
		startTransition(async () => {
			try {
				const response = await fetch("/api/feedback", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ kind, title, body, source, visibility }),
				});
				const result = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(result.error ?? "Feedback submission failed.");
				}

				setTitle("");
				setBody("");
				setStatus("Feedback submitted.");
				onSubmitted?.();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Feedback submission failed.");
			}
		});
	}

	return (
		<div>
			<fieldset className="grid gap-2">
				<legend className="sr-only">Feedback type</legend>
				{kinds.map((tab) => {
					const Icon = tab.icon;

					return (
						<button
							key={tab.value}
							type="button"
							aria-pressed={kind === tab.value}
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
			</fieldset>
			<label className="mt-5 block text-sm font-medium" htmlFor={`${source}-feedback-title`}>
				Title
			</label>
			<input
				id={`${source}-feedback-title`}
				className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
				placeholder="Title"
				value={title}
				onChange={(event) => setTitle(event.target.value)}
			/>
			<label className="mt-3 block text-sm font-medium" htmlFor={`${source}-feedback-body`}>
				Details
			</label>
			<textarea
				id={`${source}-feedback-body`}
				className="mt-2 min-h-32 w-full rounded-lg border border-glass-border bg-background/70 p-3 outline-none focus:ring-2 focus:ring-brand"
				placeholder="What should change?"
				value={body}
				onChange={(event) => setBody(event.target.value)}
			/>
			{kind === "feature" ? (
				<label className="mt-3 flex min-h-11 items-center gap-3 rounded-lg border border-glass-border bg-background/40 px-3 text-sm text-muted">
					<input
						type="checkbox"
						checked={visibility === "public"}
						onChange={(event) =>
							setVisibility(event.target.checked ? "public" : "private")
						}
					/>
					Make this request public on the feedback board
				</label>
			) : null}
			<Button
				type="button"
				variant="primary"
				className="mt-4"
				disabled={isPending}
				onClick={submit}
			>
				Submit
			</Button>
			{status ? (
				<p
					className="mt-3 text-sm text-muted"
					role={status.toLowerCase().includes("failed") ? "alert" : "status"}
				>
					{status}
				</p>
			) : null}
		</div>
	);
}
