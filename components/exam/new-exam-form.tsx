"use client";

import { ArrowRight, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ClassSummary, MaterialSummary } from "@/lib/classes/data";
import { CREDIT_COSTS, TIER_MAX_QUESTIONS_PER_EXAM, type Tier } from "@/lib/product/constants";

function parseTopics(value: string) {
	return value
		.split(/\n|,/)
		.map((topic) => topic.trim())
		.filter(Boolean)
		.slice(0, 30);
}

type SourceClass = ClassSummary & {
	materials: MaterialSummary[];
};

export function NewExamForm({
	tier,
	credits,
	classes,
}: {
	tier: Tier;
	credits: number;
	classes: SourceClass[];
}) {
	const router = useRouter();
	const maxQuestions = TIER_MAX_QUESTIONS_PER_EXAM[tier];
	const [title, setTitle] = useState("Practice Exam");
	const [className, setClassName] = useState("");
	const [classId, setClassId] = useState("");
	const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
	const [topicsText, setTopicsText] = useState("");
	const [sourceNotes, setSourceNotes] = useState("");
	const [questionCount, setQuestionCount] = useState(Math.min(12, maxQuestions));
	const [mode, setMode] = useState<"standard" | "power">("standard");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const selectedClass = useMemo(
		() => classes.find((course) => course.id === classId) ?? null,
		[classes, classId],
	);
	const materialTopics = useMemo(() => {
		return (
			selectedClass?.materials
				.filter((material) => selectedMaterialIds.includes(material.id))
				.flatMap((material) => material.extractedTopics) ?? []
		);
	}, [selectedClass, selectedMaterialIds]);
	const topics = useMemo(() => {
		return Array.from(new Set([...parseTopics(topicsText), ...materialTopics])).slice(0, 30);
	}, [topicsText, materialTopics]);
	const cost = questionCount * CREDIT_COSTS.GENERATE_QUESTION;
	const canGenerate = topics.length > 0 && cost <= credits && !isSubmitting;

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			const response = await fetch("/api/exams", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					className: selectedClass?.name ?? className,
					classId: selectedClass?.id,
					sourceMaterialIds: selectedMaterialIds,
					topics,
					sourceNotes,
					questionCount,
					mode,
				}),
			});
			const payload = (await response.json()) as { examId?: string; error?: string };

			if (!response.ok || !payload.examId) {
				throw new Error(payload.error ?? "Exam creation failed.");
			}

			router.push(`/exams/${payload.examId}`);
			router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Exam creation failed.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form className="space-y-6" onSubmit={onSubmit}>
			<div className="grid gap-4 md:grid-cols-2">
				<div>
					<label className="text-sm font-medium" htmlFor="title">
						Exam title
					</label>
					<input
						id="title"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						maxLength={120}
					/>
				</div>
				<div>
					<label className="text-sm font-medium" htmlFor="class-name">
						Class label
					</label>
					<input
						id="class-name"
						value={className}
						onChange={(event) => setClassName(event.target.value)}
						className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						placeholder="MATH 301, AP Bio, Organic Chemistry"
						maxLength={80}
					/>
				</div>
			</div>
			{classes.length > 0 ? (
				<div className="rounded-lg border border-glass-border bg-background/35 p-4">
					<label className="text-sm font-medium" htmlFor="class-source">
						Stored class
					</label>
					<select
						id="class-source"
						value={classId}
						onChange={(event) => {
							const nextClassId = event.target.value;
							setClassId(nextClassId);
							setSelectedMaterialIds([]);
							const nextClass = classes.find((course) => course.id === nextClassId);
							if (nextClass) {
								setClassName(nextClass.name);
							}
						}}
						className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
					>
						<option value="">No stored class</option>
						{classes.map((course) => (
							<option key={course.id} value={course.id}>
								{course.name}
							</option>
						))}
					</select>
					{selectedClass ? (
						<div className="mt-4 grid gap-2 md:grid-cols-2">
							{selectedClass.materials.length === 0 ? (
								<p className="text-sm text-muted">
									This class has no materials yet.
								</p>
							) : null}
							{selectedClass.materials.map((material) => (
								<label
									key={material.id}
									className="flex items-start gap-3 rounded-lg border border-glass-border bg-background/50 p-3 text-sm"
								>
									<input
										type="checkbox"
										checked={selectedMaterialIds.includes(material.id)}
										onChange={(event) => {
											setSelectedMaterialIds((current) =>
												event.target.checked
													? [...current, material.id]
													: current.filter((id) => id !== material.id),
											);
										}}
										className="mt-1"
									/>
									<span>
										<span className="font-medium">{material.filename}</span>
										<span className="block text-muted">
											{material.extractedTopics.length} extracted topics
										</span>
									</span>
								</label>
							))}
						</div>
					) : null}
				</div>
			) : null}
			<div>
				<label className="text-sm font-medium" htmlFor="topics">
					Topics
				</label>
				<textarea
					id="topics"
					value={topicsText}
					onChange={(event) => setTopicsText(event.target.value)}
					className="mt-2 min-h-36 w-full rounded-lg border border-glass-border bg-background/70 p-3 outline-none focus:ring-2 focus:ring-brand"
					placeholder="One topic per line, or separate with commas"
				/>
				<p className="mt-2 text-sm text-muted">{topics.length} topics ready</p>
			</div>
			<div>
				<label className="text-sm font-medium" htmlFor="source-notes">
					Source notes
				</label>
				<textarea
					id="source-notes"
					value={sourceNotes}
					onChange={(event) => setSourceNotes(event.target.value)}
					className="mt-2 min-h-24 w-full rounded-lg border border-glass-border bg-background/70 p-3 outline-none focus:ring-2 focus:ring-brand"
					placeholder="Optional focus, exam date, instructor preferences, or material notes"
				/>
			</div>
			<div className="grid gap-4 md:grid-cols-[1fr_220px]">
				<div className="rounded-lg border border-glass-border bg-background/40 p-4">
					<div className="flex items-center justify-between">
						<label className="text-sm font-medium" htmlFor="question-count">
							Questions
						</label>
						<span className="text-sm text-muted">Max {maxQuestions} on your tier</span>
					</div>
					<input
						id="question-count"
						type="range"
						min={1}
						max={maxQuestions}
						value={questionCount}
						onChange={(event) => setQuestionCount(Number(event.target.value))}
						className="mt-4 w-full accent-brand"
					/>
					<p className="mt-2 text-2xl font-semibold">{questionCount}</p>
				</div>
				<div className="rounded-lg border border-glass-border bg-background/40 p-4">
					<p className="text-sm font-medium">Mode</p>
					<div className="mt-3 grid grid-cols-2 gap-2">
						<button
							type="button"
							className={`rounded-lg border px-3 py-2 text-sm ${
								mode === "standard"
									? "border-brand bg-brand text-white"
									: "border-glass-border bg-background/60"
							}`}
							onClick={() => setMode("standard")}
						>
							Standard
						</button>
						<button
							type="button"
							className={`rounded-lg border px-3 py-2 text-sm ${
								mode === "power"
									? "border-premium bg-premium text-premium-foreground"
									: "border-glass-border bg-background/60"
							}`}
							onClick={() => setMode("power")}
						>
							Power
						</button>
					</div>
				</div>
			</div>
			{error ? (
				<p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>
			) : null}
			<div className="flex flex-col justify-between gap-3 rounded-lg border border-glass-border bg-glass p-4 sm:flex-row sm:items-center">
				<div>
					<p className="text-sm text-muted">Generation cost</p>
					<p className="text-2xl font-semibold">{cost} credits</p>
				</div>
				<Button type="submit" variant="primary" disabled={!canGenerate}>
					<WandSparkles aria-hidden="true" size={18} />
					{isSubmitting ? "Queuing" : "Generate"}
					<ArrowRight aria-hidden="true" size={18} />
				</Button>
			</div>
			{cost > credits ? (
				<p className="text-sm text-error">
					You need {cost - credits} more credits for this exam.
				</p>
			) : null}
		</form>
	);
}
