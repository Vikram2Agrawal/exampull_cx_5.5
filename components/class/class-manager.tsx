"use client";

import { Archive, GraduationCap, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/surface";
import type { ClassSummary } from "@/lib/classes/data";
import { EDUCATION_LEVELS } from "@/lib/product/constants";

async function readJson(response: Response) {
	const body = (await response.json().catch(() => ({}))) as { error?: string };

	if (!response.ok) {
		throw new Error(body.error ?? "Class action failed.");
	}

	return body;
}

export function ClassManager({ course }: { course: ClassSummary }) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [name, setName] = useState(course.name);
	const [institution, setInstitution] = useState(course.institution ?? "");
	const [description, setDescription] = useState(course.description ?? "");
	const [educationLevel, setEducationLevel] = useState(course.educationLevel);
	const [archived, setArchived] = useState(course.archived);
	const [message, setMessage] = useState("");

	function saveClass(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		startTransition(async () => {
			try {
				await readJson(
					await fetch(`/api/classes/${course.id}`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ name, institution, description, educationLevel }),
					}),
				);
				setMessage("Class profile saved.");
				router.refresh();
			} catch (error) {
				setMessage(error instanceof Error ? error.message : "Class update failed.");
			}
		});
	}

	function toggleArchive() {
		const nextArchived = !archived;
		startTransition(async () => {
			try {
				await readJson(
					await fetch(`/api/classes/${course.id}`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ archived: nextArchived }),
					}),
				);
				setArchived(nextArchived);
				setMessage(nextArchived ? "Class archived." : "Class restored.");
				router.refresh();
			} catch (error) {
				setMessage(error instanceof Error ? error.message : "Class archive failed.");
			}
		});
	}

	function deleteClass() {
		const firstConfirm = window.confirm("Delete this class permanently?");
		if (!firstConfirm) {
			return;
		}

		const secondConfirm = window.confirm(
			"Consider archiving instead to preserve history. Delete the class and its materials anyway?",
		);
		if (!secondConfirm) {
			return;
		}

		startTransition(async () => {
			try {
				await readJson(await fetch(`/api/classes/${course.id}`, { method: "DELETE" }));
				router.push("/classes");
			} catch (error) {
				setMessage(error instanceof Error ? error.message : "Class deletion failed.");
			}
		});
	}

	return (
		<GlassPanel className="p-5">
			<form className="space-y-4" onSubmit={saveClass}>
				<div className="flex items-center gap-3">
					<GraduationCap aria-hidden="true" className="text-secondary" size={22} />
					<h2 className="font-semibold">Class profile</h2>
				</div>
				<label className="block text-sm font-medium" htmlFor="class-edit-name">
					Name
					<input
						id="class-edit-name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						maxLength={120}
					/>
				</label>
				<label className="block text-sm font-medium" htmlFor="class-edit-institution">
					Institution
					<input
						id="class-edit-institution"
						value={institution}
						onChange={(event) => setInstitution(event.target.value)}
						className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						maxLength={120}
					/>
				</label>
				<div>
					<label className="text-sm font-medium" htmlFor="class-edit-level">
						Education level
					</label>
					<input
						id="class-edit-level"
						type="range"
						min={0}
						max={100}
						value={educationLevel}
						onChange={(event) => setEducationLevel(Number(event.target.value))}
						className="mt-3 w-full accent-brand"
					/>
					<div className="mt-2 flex flex-wrap gap-2">
						{EDUCATION_LEVELS.map((level) => (
							<button
								key={level.label}
								type="button"
								className={`rounded-lg border px-2 py-1 text-xs ${
									educationLevel === level.value
										? "border-brand bg-brand text-white"
										: "border-glass-border bg-background/40"
								}`}
								onClick={() => setEducationLevel(level.value)}
							>
								{level.label}
							</button>
						))}
					</div>
				</div>
				<label className="block text-sm font-medium" htmlFor="class-edit-description">
					Description
					<textarea
						id="class-edit-description"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						className="mt-2 min-h-28 w-full rounded-lg border border-glass-border bg-background/70 p-3 outline-none focus:ring-2 focus:ring-brand"
						maxLength={1000}
					/>
				</label>
				<div className="flex flex-wrap gap-2">
					<Button
						type="submit"
						variant="primary"
						disabled={isPending || name.trim().length < 2}
					>
						<Save aria-hidden="true" size={16} />
						Save
					</Button>
					<Button type="button" onClick={toggleArchive} disabled={isPending}>
						<Archive aria-hidden="true" size={16} />
						{archived ? "Restore" : "Archive"}
					</Button>
					<Button
						type="button"
						variant="danger"
						onClick={deleteClass}
						disabled={isPending}
					>
						<Trash2 aria-hidden="true" size={16} />
						Delete
					</Button>
				</div>
				{archived ? (
					<p className="rounded-lg bg-glass p-3 text-sm text-muted">
						This class is archived. Existing exams remain in the library.
					</p>
				) : null}
				{message ? <p className="text-sm text-muted">{message}</p> : null}
			</form>
		</GlassPanel>
	);
}
