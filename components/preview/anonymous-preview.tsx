"use client";

import { FileText, WandSparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Paper } from "@/components/ui/surface";

let fingerprintPromise: Promise<string> | null = null;

function parseTopics(value: string) {
	return value
		.split(/\n|,/)
		.map((topic) => topic.trim())
		.filter(Boolean)
		.slice(0, 8);
}

async function getPreviewFingerprint() {
	fingerprintPromise ??= import("@fingerprintjs/fingerprintjs").then(async (module) => {
		const agent = await module.default.load();
		const result = await agent.get();
		return result.visitorId;
	});

	return fingerprintPromise;
}

export function AnonymousPreview() {
	const [title, setTitle] = useState("Thermodynamics Midterm");
	const [topicsText, setTopicsText] = useState(
		"Second law of thermodynamics\nIsothermal expansion\nEntropy statements",
	);
	const [previewImageBase64, setPreviewImageBase64] = useState("");
	const [previewId, setPreviewId] = useState("");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();
	const imageSrc = previewImageBase64.startsWith("data:")
		? previewImageBase64
		: `data:image/png;base64,${previewImageBase64}`;

	function generatePreview() {
		startTransition(async () => {
			try {
				const fingerprint = await getPreviewFingerprint();
				const response = await fetch("/api/preview", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Preview-Fingerprint": fingerprint,
					},
					body: JSON.stringify({
						title,
						topics: parseTopics(topicsText),
						questionCount: 3,
					}),
				});
				const body = (await response.json().catch(() => ({}))) as {
					error?: string;
					previewId?: string;
					previewImageBase64?: string;
				};

				if (
					!response.ok ||
					typeof body.previewImageBase64 !== "string" ||
					typeof body.previewId !== "string"
				) {
					throw new Error(body.error ?? "Preview generation failed.");
				}

				setPreviewImageBase64(body.previewImageBase64);
				setPreviewId(body.previewId);
				window.localStorage.setItem("exampull_preview_id", body.previewId);
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
			{previewImageBase64 ? (
				<figure
					className="overflow-hidden rounded-lg border border-glass-border bg-paper shadow-paper"
					onContextMenu={(event) => event.preventDefault()}
				>
					<div className="relative mx-auto max-h-[620px] overflow-hidden bg-paper">
						<Image
							src={imageSrc}
							alt="Blurred preview of the first page of a generated practice exam"
							width={1200}
							height={1550}
							unoptimized
							className="w-full select-none"
							draggable={false}
						/>
						<div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-paper/70 backdrop-blur-md" />
						<div className="absolute inset-x-0 bottom-0 grid min-h-40 place-items-center bg-gradient-to-t from-paper via-paper/90 to-paper/10 p-6 text-center">
							<div>
								<p className="text-lg font-semibold text-ink">Full exam locked</p>
								<p className="mt-2 text-sm text-ink-muted">
									Create a free account to claim the complete PDF.
								</p>
								<Link
									href={previewId ? `/sign-up?preview=${previewId}` : "/sign-up"}
									className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover"
								>
									Create free account
								</Link>
							</div>
						</div>
					</div>
				</figure>
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
