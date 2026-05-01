"use client";

import { FileText, WandSparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Paper } from "@/components/ui/surface";

function parseTopics(value: string) {
	return value
		.split(/\n|,/)
		.map((topic) => topic.trim())
		.filter(Boolean)
		.slice(0, 8);
}

export function AnonymousPreview() {
	const [title, setTitle] = useState("Thermodynamics and Entropy");
	const [topicsText, setTopicsText] = useState(
		"Second law of thermodynamics\nIsothermal expansion\nEntropy statements",
	);
	const [pdfBase64, setPdfBase64] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function generatePreview() {
		startTransition(async () => {
			try {
				const response = await fetch("/api/preview", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title,
						topics: parseTopics(topicsText),
						questionCount: 3,
					}),
				});
				const body = (await response.json().catch(() => ({}))) as {
					error?: string;
					pdfBase64?: string;
				};

				if (!response.ok || typeof body.pdfBase64 !== "string") {
					throw new Error(body.error ?? "Preview generation failed.");
				}

				setPdfBase64(body.pdfBase64);
				setStatus("Preview ready.");
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Preview generation failed.");
			}
		});
	}

	return (
		<div className="space-y-4">
			<div className="grid gap-3 rounded-lg border border-glass-border bg-glass p-4">
				<label className="text-sm font-medium">
					Preview title
					<input
						className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
					/>
				</label>
				<label className="text-sm font-medium">
					Topics
					<textarea
						className="mt-2 min-h-24 w-full rounded-lg border border-glass-border bg-background/70 p-3 outline-none focus:ring-2 focus:ring-brand"
						value={topicsText}
						onChange={(event) => setTopicsText(event.target.value)}
					/>
				</label>
				<Button
					type="button"
					variant="primary"
					disabled={isPending}
					onClick={generatePreview}
				>
					<WandSparkles aria-hidden="true" size={18} />
					{isPending ? "Typesetting" : "Generate preview"}
				</Button>
				{status ? <p className="text-sm text-muted">{status}</p> : null}
			</div>
			{pdfBase64 ? (
				<div className="overflow-hidden rounded-lg border border-glass-border bg-paper shadow-paper">
					<iframe
						title="Anonymous practice exam preview"
						src={`data:application/pdf;base64,${pdfBase64}`}
						className="h-[560px] w-full bg-paper"
					/>
				</div>
			) : (
				<Paper interactive className="p-8">
					<div className="border-b border-paper-border pb-5 text-center">
						<p className="text-xs uppercase tracking-[0.18em] text-ink-muted">
							Practice Exam
						</p>
						<h2 className="mt-3 text-3xl font-semibold">{title}</h2>
						<p className="mt-2 text-sm text-ink-muted">Preview copy</p>
					</div>
					<ol className="mt-6 space-y-5 text-base leading-7">
						{parseTopics(topicsText)
							.slice(0, 3)
							.map((topic, index) => (
								<li key={topic}>
									<strong>{index + 1}.</strong> Answer a representative question
									about {topic}.
								</li>
							))}
					</ol>
					<div className="mt-10 flex h-28 items-center justify-center rounded-lg border border-dashed border-paper-border text-ink-muted">
						<FileText aria-hidden="true" size={22} />
					</div>
				</Paper>
			)}
		</div>
	);
}
