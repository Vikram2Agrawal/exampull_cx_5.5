"use client";

import {
	Archive,
	Bookmark,
	CheckSquare,
	FolderInput,
	Grid2X2,
	List,
	Search,
	Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { GlassPanel, Paper } from "@/components/ui/surface";
import type { ClassSummary } from "@/lib/classes/data";
import type { ExamSummary } from "@/lib/exams/data";
import { cn } from "@/lib/utils";
import { ExamCard } from "./exam-card";

type LibraryAction = "archive" | "restore" | "bookmark" | "unbookmark" | "delete" | "move_class";

async function readJson(response: Response) {
	const body = (await response.json().catch(() => ({}))) as { error?: string };

	if (!response.ok) {
		throw new Error(body.error ?? "Library action failed.");
	}

	return body;
}

function normalized(value: string) {
	return value.toLowerCase().trim();
}

function includesSearch(exam: ExamSummary, search: string) {
	if (!search) {
		return true;
	}

	const haystack = normalized([exam.title, exam.className, ...exam.topics].join(" "));
	return search
		.split(/\s+/)
		.filter(Boolean)
		.every((token) => haystack.includes(token));
}

function labelForToken(value: string) {
	return value.replaceAll("_", " ");
}

export function ExamLibrary({
	initialExams,
	classes,
}: {
	initialExams: ExamSummary[];
	classes: ClassSummary[];
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [exams, setExams] = useState(initialExams);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [classFilter, setClassFilter] = useState("all");
	const [styleFilter, setStyleFilter] = useState("all");
	const [difficultyFilter, setDifficultyFilter] = useState("all");
	const [bookmarkFilter, setBookmarkFilter] = useState("all");
	const [archiveFilter, setArchiveFilter] = useState<"active" | "archived" | "all">("active");
	const [view, setView] = useState<"grid" | "list">("grid");
	const [bulkClassId, setBulkClassId] = useState("");
	const [message, setMessage] = useState("");

	const styles = useMemo(
		() => Array.from(new Set(exams.flatMap((exam) => exam.questionStyles))).sort(),
		[exams],
	);
	const difficulties = useMemo(
		() => Array.from(new Set(exams.flatMap((exam) => exam.difficulties))).sort(),
		[exams],
	);
	const filteredExams = useMemo(() => {
		const searchValue = normalized(search);

		return exams.filter((exam) => {
			if (!includesSearch(exam, searchValue)) return false;
			if (statusFilter !== "all" && exam.status !== statusFilter) return false;
			if (classFilter !== "all" && (exam.classId ?? "") !== classFilter) return false;
			if (styleFilter !== "all" && !exam.questionStyles.includes(styleFilter)) return false;
			if (difficultyFilter !== "all" && !exam.difficulties.includes(difficultyFilter)) {
				return false;
			}
			if (bookmarkFilter === "bookmarked" && !exam.bookmarked) return false;
			if (bookmarkFilter === "unbookmarked" && exam.bookmarked) return false;
			if (archiveFilter === "active" && exam.archived) return false;
			if (archiveFilter === "archived" && !exam.archived) return false;

			return true;
		});
	}, [
		exams,
		search,
		statusFilter,
		classFilter,
		styleFilter,
		difficultyFilter,
		bookmarkFilter,
		archiveFilter,
	]);
	const selectedExams = exams.filter((exam) => selectedIds.includes(exam.id));
	const allVisibleSelected =
		filteredExams.length > 0 && filteredExams.every((exam) => selectedIds.includes(exam.id));

	function toggleSelected(examId: string) {
		setSelectedIds((current) =>
			current.includes(examId) ? current.filter((id) => id !== examId) : [...current, examId],
		);
	}

	function toggleAllVisible() {
		if (allVisibleSelected) {
			setSelectedIds((current) =>
				current.filter((id) => !filteredExams.some((exam) => exam.id === id)),
			);
			return;
		}

		setSelectedIds((current) =>
			Array.from(new Set([...current, ...filteredExams.map((exam) => exam.id)])),
		);
	}

	function applyLocalAction(action: LibraryAction, classId?: string | null) {
		const selectedClass = classes.find((course) => course.id === classId);

		setExams((current) => {
			if (action === "delete") {
				return current.filter((exam) => !selectedIds.includes(exam.id));
			}

			return current.map((exam) => {
				if (!selectedIds.includes(exam.id)) {
					return exam;
				}

				if (action === "archive") return { ...exam, archived: true };
				if (action === "restore") return { ...exam, archived: false };
				if (action === "bookmark") return { ...exam, bookmarked: true };
				if (action === "unbookmark") return { ...exam, bookmarked: false };
				if (action === "move_class") {
					return {
						...exam,
						classId: classId ?? null,
						className: selectedClass?.name ?? "Manual topics",
					};
				}

				return exam;
			});
		});
	}

	function runBulkAction(action: LibraryAction) {
		if (selectedIds.length === 0) {
			setMessage("Select at least one exam.");
			return;
		}

		const classId = action === "move_class" ? bulkClassId || null : undefined;

		if (action === "delete") {
			const confirmed = window.confirm(
				`Delete ${selectedIds.length} exam${selectedIds.length === 1 ? "" : "s"} permanently?`,
			);
			if (!confirmed) {
				return;
			}
		}

		startTransition(async () => {
			try {
				await readJson(
					await fetch("/api/exams/bulk", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ action, examIds: selectedIds, classId }),
					}),
				);
				applyLocalAction(action, classId);
				setSelectedIds([]);
				setMessage("Library updated.");
				router.refresh();
			} catch (error) {
				setMessage(error instanceof Error ? error.message : "Library action failed.");
			}
		});
	}

	return (
		<div className="space-y-6">
			<GlassPanel className="p-4">
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-3 md:flex-row">
						<label className="relative flex-1">
							<Search
								aria-hidden="true"
								className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
								size={18}
							/>
							<input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								className="h-11 w-full rounded-lg border border-glass-border bg-background/70 pl-10 pr-3 outline-none focus:ring-2 focus:ring-brand"
								placeholder="Search title, topic, or class"
							/>
						</label>
						<select
							value={statusFilter}
							onChange={(event) => setStatusFilter(event.target.value)}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3"
						>
							<option value="all">All statuses</option>
							{Array.from(new Set(exams.map((exam) => exam.status))).map((status) => (
								<option key={status} value={status}>
									{labelForToken(status)}
								</option>
							))}
						</select>
						<select
							value={classFilter}
							onChange={(event) => setClassFilter(event.target.value)}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3"
						>
							<option value="all">All classes</option>
							<option value="">Manual topics</option>
							{classes.map((course) => (
								<option key={course.id} value={course.id}>
									{course.name}
								</option>
							))}
						</select>
					</div>
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<select
								value={styleFilter}
								onChange={(event) => setStyleFilter(event.target.value)}
								className="h-10 rounded-lg border border-glass-border bg-background/70 px-3 text-sm"
							>
								<option value="all">All styles</option>
								{styles.map((style) => (
									<option key={style} value={style}>
										{labelForToken(style)}
									</option>
								))}
							</select>
							<select
								value={difficultyFilter}
								onChange={(event) => setDifficultyFilter(event.target.value)}
								className="h-10 rounded-lg border border-glass-border bg-background/70 px-3 text-sm"
							>
								<option value="all">All difficulties</option>
								{difficulties.map((difficulty) => (
									<option key={difficulty} value={difficulty}>
										{labelForToken(difficulty)}
									</option>
								))}
							</select>
							<select
								value={bookmarkFilter}
								onChange={(event) => setBookmarkFilter(event.target.value)}
								className="h-10 rounded-lg border border-glass-border bg-background/70 px-3 text-sm"
							>
								<option value="all">All bookmarks</option>
								<option value="bookmarked">Bookmarked</option>
								<option value="unbookmarked">Unbookmarked</option>
							</select>
							<select
								value={archiveFilter}
								onChange={(event) =>
									setArchiveFilter(
										event.target.value as "active" | "archived" | "all",
									)
								}
								className="h-10 rounded-lg border border-glass-border bg-background/70 px-3 text-sm"
							>
								<option value="active">Active</option>
								<option value="archived">Archived</option>
								<option value="all">Active + archived</option>
							</select>
						</div>
						<div className="flex gap-2">
							<Button
								type="button"
								size="icon"
								variant={view === "grid" ? "primary" : "secondary"}
								onClick={() => setView("grid")}
							>
								<Grid2X2 aria-label="Grid view" size={18} />
							</Button>
							<Button
								type="button"
								size="icon"
								variant={view === "list" ? "primary" : "secondary"}
								onClick={() => setView("list")}
							>
								<List aria-label="List view" size={18} />
							</Button>
							<Button type="button" onClick={toggleAllVisible}>
								<CheckSquare aria-hidden="true" size={16} />
								{allVisibleSelected ? "Clear visible" : "Select visible"}
							</Button>
						</div>
					</div>
				</div>
			</GlassPanel>
			{selectedIds.length > 0 ? (
				<GlassPanel className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
					<p className="text-sm text-muted">
						{selectedExams.length} selected across {filteredExams.length} visible.
					</p>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							onClick={() => runBulkAction("archive")}
							disabled={isPending}
						>
							<Archive aria-hidden="true" size={16} />
							Archive
						</Button>
						<Button
							type="button"
							onClick={() => runBulkAction("restore")}
							disabled={isPending}
						>
							<Archive aria-hidden="true" size={16} />
							Restore
						</Button>
						<Button
							type="button"
							onClick={() => runBulkAction("bookmark")}
							disabled={isPending}
						>
							<Bookmark aria-hidden="true" size={16} />
							Bookmark
						</Button>
						<Button
							type="button"
							onClick={() => runBulkAction("unbookmark")}
							disabled={isPending}
						>
							<Bookmark aria-hidden="true" size={16} />
							Unbookmark
						</Button>
						<select
							value={bulkClassId}
							onChange={(event) => setBulkClassId(event.target.value)}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 text-sm"
						>
							<option value="">Manual topics</option>
							{classes.map((course) => (
								<option key={course.id} value={course.id}>
									{course.name}
								</option>
							))}
						</select>
						<Button
							type="button"
							onClick={() => runBulkAction("move_class")}
							disabled={isPending}
						>
							<FolderInput aria-hidden="true" size={16} />
							Move
						</Button>
						<Button
							type="button"
							variant="danger"
							onClick={() => runBulkAction("delete")}
							disabled={isPending}
						>
							<Trash2 aria-hidden="true" size={16} />
							Delete
						</Button>
					</div>
				</GlassPanel>
			) : null}
			{message ? <p className="text-sm text-muted">{message}</p> : null}
			{filteredExams.length > 0 ? (
				view === "grid" ? (
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{filteredExams.map((exam) => (
							<div key={exam.id} className="relative">
								<label className="absolute left-3 top-3 z-10 rounded-lg bg-background/90 p-2 shadow-sm">
									<input
										type="checkbox"
										checked={selectedIds.includes(exam.id)}
										onChange={() => toggleSelected(exam.id)}
										aria-label={`Select ${exam.title}`}
									/>
								</label>
								<ExamCard exam={exam} />
							</div>
						))}
					</div>
				) : (
					<GlassPanel className="overflow-hidden">
						<div className="divide-y divide-glass-border">
							{filteredExams.map((exam) => (
								<div
									key={exam.id}
									className="grid gap-3 p-4 md:grid-cols-[32px_1.4fr_1fr_130px_120px]"
								>
									<input
										type="checkbox"
										checked={selectedIds.includes(exam.id)}
										onChange={() => toggleSelected(exam.id)}
										aria-label={`Select ${exam.title}`}
									/>
									<a
										href={`/exams/${exam.id}`}
										className="font-semibold hover:text-brand"
									>
										{exam.title}
									</a>
									<span className="text-sm text-muted">{exam.className}</span>
									<span className="text-sm text-muted">
										{exam.questionCount} questions
									</span>
									<span
										className={cn(
											"text-sm capitalize",
											exam.archived ? "text-muted" : "text-foreground",
										)}
									>
										{labelForToken(exam.status)}
									</span>
								</div>
							))}
						</div>
					</GlassPanel>
				)
			) : (
				<GlassPanel className="p-6">
					<Paper className="mx-auto max-w-xl p-8 text-center">
						<h2 className="text-xl font-semibold">No matching exams</h2>
						<p className="mt-2 text-sm text-muted">
							Adjust the filters or create a new practice exam.
						</p>
					</Paper>
				</GlassPanel>
			)}
		</div>
	);
}
