"use client";

import { ArrowRight, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { EDUCATION_LEVELS } from "@/lib/product/constants";

type ClassCreateResponse = {
	classId?: string;
	error?: string;
};

export function ClassForm() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [institution, setInstitution] = useState("");
	const [description, setDescription] = useState("");
	const [educationLevel, setEducationLevel] = useState<number>(EDUCATION_LEVELS[4]?.value ?? 45);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			const response = await fetch("/api/classes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, institution, description, educationLevel }),
			});
			const payload = (await response.json()) as ClassCreateResponse;

			if (!response.ok || !payload.classId) {
				throw new Error(payload.error ?? "Class creation failed.");
			}

			router.push(`/classes/${payload.classId}`);
			router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Class creation failed.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form className="space-y-5" onSubmit={onSubmit}>
			<div>
				<label className="block text-sm font-medium" htmlFor="name">
					Class name
				</label>
				<input
					id="name"
					required
					value={name}
					onChange={(event) => setName(event.target.value)}
					className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
					placeholder="MATH 301 - Real Analysis"
					maxLength={120}
				/>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<div>
					<label className="block text-sm font-medium" htmlFor="institution">
						Institution
					</label>
					<input
						id="institution"
						value={institution}
						onChange={(event) => setInstitution(event.target.value)}
						className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						placeholder="Optional"
						maxLength={120}
					/>
				</div>
				<div>
					<label className="block text-sm font-medium" htmlFor="education-level">
						Education level
					</label>
					<input
						id="education-level"
						type="range"
						min={0}
						max={100}
						value={educationLevel}
						onChange={(event) => setEducationLevel(Number(event.target.value))}
						className="mt-5 w-full accent-brand"
					/>
					<p className="mt-1 text-sm text-muted">{educationLevel}/100</p>
				</div>
			</div>
			<div className="grid gap-2 sm:grid-cols-2">
				{EDUCATION_LEVELS.map((level) => (
					<button
						key={level.label}
						type="button"
						className={`rounded-lg border px-3 py-3 text-left text-sm ${
							educationLevel === level.value
								? "border-brand bg-brand text-white"
								: "border-glass-border bg-background/40 hover:bg-glass"
						}`}
						onClick={() => setEducationLevel(level.value)}
					>
						<GraduationCap aria-hidden="true" className="mr-2 inline" size={16} />
						{level.label}
						<span className="float-right">{level.value}</span>
					</button>
				))}
			</div>
			<div>
				<label className="block text-sm font-medium" htmlFor="description">
					Description
				</label>
				<textarea
					id="description"
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					className="mt-2 min-h-28 w-full rounded-lg border border-glass-border bg-background/70 p-3 outline-none focus:ring-2 focus:ring-brand"
					placeholder="Optional syllabus notes, instructor tendencies, or exam cadence"
					maxLength={1000}
				/>
			</div>
			{error ? (
				<p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>
			) : null}
			<Button
				type="submit"
				variant="primary"
				disabled={isSubmitting || name.trim().length < 2}
			>
				{isSubmitting ? "Creating" : "Create class"}
				<ArrowRight aria-hidden="true" size={18} />
			</Button>
		</form>
	);
}
