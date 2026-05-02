"use client";

import {
	ArrowDown,
	ArrowRight,
	ArrowUp,
	Copy,
	FileUp,
	ListPlus,
	Plus,
	RefreshCw,
	Trash2,
	WandSparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PowerQuestionSlot, QuestionDifficulty, QuestionStyle } from "@/lib/billing/credits";
import type { ClassSummary, MaterialSummary } from "@/lib/classes/data";
import { CREDIT_COSTS, TIER_MAX_QUESTIONS_PER_EXAM, type Tier } from "@/lib/product/constants";

const styleOptions = [
	{ value: "multiple_choice", label: "MC" },
	{ value: "short_answer", label: "Short answer" },
	{ value: "calculation", label: "Calculation" },
	{ value: "essay", label: "Essay" },
	{ value: "proof", label: "Proof" },
] satisfies { value: QuestionStyle; label: string }[];

const difficultyOptions = [
	{ value: "light", label: "Light" },
	{ value: "balanced", label: "Balanced" },
	{ value: "hardcore", label: "Hardcore" },
] satisfies { value: QuestionDifficulty; label: string }[];

type PowerSlotDraft = PowerQuestionSlot & {
	id: string;
};

type ExamSourceUpload = {
	id: string;
	filename: string;
	contentType: string;
	sizeBytes: number;
	focus: string | null;
	status: string;
	styleReference: boolean;
	extractedTopics: string[];
	extractionProgress: SourceExtractionProgress | null;
	createdAt: string;
	uploadedAt: string | null;
};

type SourceExtractionProgress = {
	stage: string;
	detail: string;
	percent: number;
	pagesRead: number | null;
	totalPages: number | null;
};

const draftStorageKey = "exampull:new-exam-draft";
const maxUploadBytes = 100 * 1024 * 1024;

function parseTopics(value: string) {
	return value
		.split(/\n|,/)
		.map((topic) => topic.trim())
		.filter(Boolean)
		.slice(0, 30);
}

function slotId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createPowerSlot(topic = ""): PowerSlotDraft {
	return {
		id: slotId(),
		topic,
		style: "short_answer",
		difficulty: "balanced",
		points: 10,
	};
}

function toServerPowerSlots(slots: PowerSlotDraft[]): PowerQuestionSlot[] {
	return slots.map((slot) => ({
		topic: slot.topic.trim(),
		style: slot.style,
		difficulty: slot.difficulty,
		points: slot.points,
	}));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function boundedNumber(value: unknown, min: number, max: number) {
	return typeof value === "number" ? Math.max(min, Math.min(max, value)) : null;
}

function isQuestionStyle(value: unknown): value is QuestionStyle {
	return styleOptions.some((option) => option.value === value);
}

function isQuestionDifficulty(value: unknown): value is QuestionDifficulty {
	return difficultyOptions.some((option) => option.value === value);
}

function powerSlotDrafts(value: unknown): PowerSlotDraft[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter(isRecord).flatMap((item) => {
		const id = typeof item.id === "string" ? item.id : slotId();
		const topic = typeof item.topic === "string" ? item.topic : "";
		const style = styleOptions.some((option) => option.value === item.style)
			? (item.style as QuestionStyle)
			: "short_answer";
		const difficulty = difficultyOptions.some((option) => option.value === item.difficulty)
			? (item.difficulty as QuestionDifficulty)
			: "balanced";
		const points = typeof item.points === "number" ? item.points : 10;

		return [{ id, topic, style, difficulty, points }];
	});
}

function sourceUploadDrafts(value: unknown): ExamSourceUpload[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter(isRecord).flatMap((item) => {
		const id = typeof item.id === "string" ? item.id : "";
		const filename = typeof item.filename === "string" ? item.filename : "";
		const contentType =
			typeof item.contentType === "string" ? item.contentType : "application/octet-stream";
		const sizeBytes = typeof item.sizeBytes === "number" ? item.sizeBytes : 0;
		const status = typeof item.status === "string" ? item.status : "uploading";
		const createdAt = typeof item.createdAt === "string" ? item.createdAt : "";
		const uploadedAt = typeof item.uploadedAt === "string" ? item.uploadedAt : null;
		const extractionProgress = extractionProgressDraft(item.extractionProgress);

		if (!id || !filename) {
			return [];
		}

		return [
			{
				id,
				filename,
				contentType,
				sizeBytes,
				focus: typeof item.focus === "string" && item.focus ? item.focus : null,
				status,
				styleReference: Boolean(item.styleReference ?? false),
				extractedTopics: stringArray(item.extractedTopics),
				extractionProgress,
				createdAt,
				uploadedAt,
			},
		];
	});
}

function extractionProgressDraft(value: unknown): SourceExtractionProgress | null {
	if (!isRecord(value)) {
		return null;
	}

	const stage = typeof value.stage === "string" ? value.stage : "";
	const detail = typeof value.detail === "string" ? value.detail : "";
	const percent = typeof value.percent === "number" ? value.percent : 0;

	if (!stage || !detail) {
		return null;
	}

	return {
		stage,
		detail,
		percent: Math.max(0, Math.min(100, Math.round(percent))),
		pagesRead: typeof value.pagesRead === "number" ? value.pagesRead : null,
		totalPages: typeof value.totalPages === "number" ? value.totalPages : null,
	};
}

function mergeSourceUploads(current: ExamSourceUpload[], updates: ExamSourceUpload[]) {
	const updatedById = new Map(updates.map((upload) => [upload.id, upload]));

	return current.map((upload) => updatedById.get(upload.id) ?? upload);
}

function uploadIsExtracting(upload: ExamSourceUpload) {
	return upload.status === "uploading" || upload.status === "extracting_topics";
}

function uploadStatusText(upload: ExamSourceUpload) {
	if (upload.status === "ready") return "Ready";
	if (upload.status === "ready_with_warnings") return "Ready with warning";
	if (upload.status === "extracting_topics") return "Extracting topics";
	if (upload.status === "uploading") return "Uploading";
	return upload.status.replaceAll("_", " ");
}

function uploadPageProgressText(progress: SourceExtractionProgress) {
	if (progress.pagesRead === null || progress.totalPages === null) {
		return null;
	}

	return `${progress.pagesRead} of ${progress.totalPages} pages read`;
}

type SourceClass = ClassSummary & {
	materials: MaterialSummary[];
};

export function NewExamForm({
	tier,
	credits,
	boostAvailable,
	priorExamCount,
	classes,
}: {
	tier: Tier;
	credits: number;
	boostAvailable: boolean;
	priorExamCount: number;
	classes: SourceClass[];
}) {
	const router = useRouter();
	const [useScholarBoost, setUseScholarBoost] = useState(false);
	const boostUnlocked = boostAvailable && priorExamCount > 0;
	const effectiveTier: Tier = useScholarBoost ? "scholar" : tier;
	const maxQuestions = TIER_MAX_QUESTIONS_PER_EXAM[effectiveTier];
	const [title, setTitle] = useState("Practice Exam");
	const [className, setClassName] = useState("");
	const [classId, setClassId] = useState("");
	const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
	const [sourceUploads, setSourceUploads] = useState<ExamSourceUpload[]>([]);
	const [uploadFocus, setUploadFocus] = useState("");
	const [uploadStyleReference, setUploadStyleReference] = useState(false);
	const [topicsText, setTopicsText] = useState("");
	const [sourceNotes, setSourceNotes] = useState("");
	const [questionCount, setQuestionCount] = useState(Math.min(12, maxQuestions));
	const [mode, setMode] = useState<"standard" | "power">("standard");
	const [powerSlots, setPowerSlots] = useState<PowerSlotDraft[]>([]);
	const [mirrorInstructorStyle, setMirrorInstructorStyle] = useState(true);
	const [quickTopic, setQuickTopic] = useState("");
	const [quickStyle, setQuickStyle] = useState<QuestionStyle>("multiple_choice");
	const [quickDifficulty, setQuickDifficulty] = useState<QuestionDifficulty>("balanced");
	const [quickPoints, setQuickPoints] = useState(5);
	const [quickCount, setQuickCount] = useState(5);
	const [rangeStart, setRangeStart] = useState(1);
	const [rangeEnd, setRangeEnd] = useState(5);
	const [rangeTopic, setRangeTopic] = useState("");
	const [rangeStyle, setRangeStyle] = useState<QuestionStyle>("short_answer");
	const [rangeDifficulty, setRangeDifficulty] = useState<QuestionDifficulty>("balanced");
	const [rangePoints, setRangePoints] = useState(10);
	const [isUploadingSource, setIsUploadingSource] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		const rawDraft = window.localStorage.getItem(draftStorageKey);
		if (!rawDraft) {
			return;
		}

		try {
			const draft: unknown = JSON.parse(rawDraft);
			if (!isRecord(draft)) {
				return;
			}

			if (typeof draft.title === "string") setTitle(draft.title);
			if (typeof draft.className === "string") setClassName(draft.className);
			if (typeof draft.classId === "string") setClassId(draft.classId);
			if (typeof draft.topicsText === "string") setTopicsText(draft.topicsText);
			if (typeof draft.sourceNotes === "string") setSourceNotes(draft.sourceNotes);
			if (typeof draft.uploadFocus === "string") setUploadFocus(draft.uploadFocus);
			if (typeof draft.uploadStyleReference === "boolean") {
				setUploadStyleReference(draft.uploadStyleReference);
			}
			if (typeof draft.questionCount === "number") {
				setQuestionCount(Math.max(1, Math.min(maxQuestions, draft.questionCount)));
			}
			if (draft.mode === "standard" || draft.mode === "power") setMode(draft.mode);
			if (typeof draft.mirrorInstructorStyle === "boolean") {
				setMirrorInstructorStyle(draft.mirrorInstructorStyle);
			}
			if (typeof draft.useScholarBoost === "boolean") {
				setUseScholarBoost(draft.useScholarBoost && boostUnlocked);
			}
			setSelectedMaterialIds(stringArray(draft.selectedMaterialIds));
			setSourceUploads(sourceUploadDrafts(draft.sourceUploads));
			setPowerSlots(powerSlotDrafts(draft.powerSlots));
			if (typeof draft.quickTopic === "string") setQuickTopic(draft.quickTopic);
			const savedQuickCount = boundedNumber(draft.quickCount, 1, 20);
			if (savedQuickCount) setQuickCount(savedQuickCount);
			if (isQuestionStyle(draft.quickStyle)) setQuickStyle(draft.quickStyle);
			if (isQuestionDifficulty(draft.quickDifficulty)) {
				setQuickDifficulty(draft.quickDifficulty);
			}
			const savedQuickPoints = boundedNumber(draft.quickPoints, 1, 100);
			if (savedQuickPoints) setQuickPoints(savedQuickPoints);
			const savedRangeStart = boundedNumber(draft.rangeStart, 1, maxQuestions);
			if (savedRangeStart) setRangeStart(savedRangeStart);
			const savedRangeEnd = boundedNumber(draft.rangeEnd, 1, maxQuestions);
			if (savedRangeEnd) setRangeEnd(savedRangeEnd);
			if (typeof draft.rangeTopic === "string") setRangeTopic(draft.rangeTopic);
			if (isQuestionStyle(draft.rangeStyle)) setRangeStyle(draft.rangeStyle);
			if (isQuestionDifficulty(draft.rangeDifficulty)) {
				setRangeDifficulty(draft.rangeDifficulty);
			}
			const savedRangePoints = boundedNumber(draft.rangePoints, 1, 100);
			if (savedRangePoints) setRangePoints(savedRangePoints);
		} catch {
			window.localStorage.removeItem(draftStorageKey);
		}
	}, [boostUnlocked, maxQuestions]);
	useEffect(() => {
		window.localStorage.setItem(
			draftStorageKey,
			JSON.stringify({
				title,
				className,
				classId,
				selectedMaterialIds,
				sourceUploads,
				topicsText,
				sourceNotes,
				uploadFocus,
				uploadStyleReference,
				questionCount,
				mode,
				powerSlots,
				mirrorInstructorStyle,
				useScholarBoost,
				quickTopic,
				quickStyle,
				quickDifficulty,
				quickPoints,
				quickCount,
				rangeStart,
				rangeEnd,
				rangeTopic,
				rangeStyle,
				rangeDifficulty,
				rangePoints,
			}),
		);
	}, [
		title,
		className,
		classId,
		selectedMaterialIds,
		sourceUploads,
		topicsText,
		sourceNotes,
		uploadFocus,
		uploadStyleReference,
		questionCount,
		mode,
		powerSlots,
		mirrorInstructorStyle,
		useScholarBoost,
		quickTopic,
		quickStyle,
		quickDifficulty,
		quickPoints,
		quickCount,
		rangeStart,
		rangeEnd,
		rangeTopic,
		rangeStyle,
		rangeDifficulty,
		rangePoints,
	]);
	useEffect(() => {
		const maxRange = Math.max(1, powerSlots.length);
		setRangeStart((current) => Math.max(1, Math.min(current, maxRange)));
		setRangeEnd((current) => Math.max(1, Math.min(current, maxRange)));
	}, [powerSlots.length]);
	const pendingUploadIds = useMemo(
		() =>
			sourceUploads
				.filter(uploadIsExtracting)
				.map((upload) => upload.id)
				.join(","),
		[sourceUploads],
	);
	useEffect(() => {
		if (!pendingUploadIds) {
			return;
		}

		let cancelled = false;
		const interval = window.setInterval(() => {
			void (async () => {
				const response = await fetch(`/api/exam-uploads?ids=${pendingUploadIds}`);
				const payload = (await response.json()) as {
					uploads?: ExamSourceUpload[];
					error?: string;
				};

				if (!cancelled && response.ok && payload.uploads) {
					setSourceUploads((current) =>
						mergeSourceUploads(current, payload.uploads ?? []),
					);
				}
			})();
		}, 2500);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [pendingUploadIds]);
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
	const uploadTopics = useMemo(
		() => sourceUploads.flatMap((upload) => upload.extractedTopics),
		[sourceUploads],
	);
	const topics = useMemo(() => {
		return Array.from(
			new Set([
				...parseTopics(topicsText),
				...materialTopics,
				...uploadTopics,
				...powerSlots.map((slot) => slot.topic.trim()).filter(Boolean),
			]),
		).slice(0, 30);
	}, [topicsText, materialTopics, uploadTopics, powerSlots]);
	const configuredQuestionCount = mode === "power" ? powerSlots.length : questionCount;
	const rawCost = configuredQuestionCount * CREDIT_COSTS.GENERATE_QUESTION;
	const cost = useScholarBoost ? 0 : rawCost;
	const canGenerate =
		topics.length > 0 &&
		(useScholarBoost || cost <= credits) &&
		!isUploadingSource &&
		!isSubmitting &&
		(mode === "standard" ||
			(effectiveTier !== "free" &&
				powerSlots.length > 0 &&
				powerSlots.every((slot) => slot.topic.trim().length > 0)));

	async function onSourceFilesSelected(event: ChangeEvent<HTMLInputElement>) {
		const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
		event.currentTarget.value = "";

		if (files.length === 0) {
			return;
		}

		setIsUploadingSource(true);
		setError(null);

		try {
			for (const file of files) {
				if (file.size > maxUploadBytes) {
					throw new Error(`${file.name} is over the 100 MB upload limit.`);
				}

				const startResponse = await fetch("/api/exam-uploads", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						filename: file.name,
						contentType: file.type || "application/octet-stream",
						sizeBytes: file.size,
						focus: uploadFocus,
						styleReference: uploadStyleReference,
					}),
				});
				const startPayload = (await startResponse.json()) as {
					uploadId?: string;
					uploadUrl?: string;
					error?: string;
				};

				if (!startResponse.ok || !startPayload.uploadUrl || !startPayload.uploadId) {
					throw new Error(startPayload.error ?? "Could not start source upload.");
				}

				const uploadResponse = await fetch(startPayload.uploadUrl, {
					method: "PUT",
					headers: { "Content-Type": file.type || "application/octet-stream" },
					body: file,
				});

				if (!uploadResponse.ok) {
					throw new Error(`${file.name} failed to upload.`);
				}

				const completeResponse = await fetch(`/api/exam-uploads/${startPayload.uploadId}`, {
					method: "PATCH",
				});
				const completePayload = (await completeResponse.json()) as {
					upload?: ExamSourceUpload;
					error?: string;
				};

				if (!completeResponse.ok || !completePayload.upload) {
					throw new Error(completePayload.error ?? "Could not finish source upload.");
				}

				const completedUpload = completePayload.upload;
				setSourceUploads((current) => [...current, completedUpload]);
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Source upload failed.");
		} finally {
			setIsUploadingSource(false);
		}
	}

	async function removeSourceUpload(uploadId: string) {
		setSourceUploads((current) => current.filter((upload) => upload.id !== uploadId));
		await fetch(`/api/exam-uploads/${uploadId}`, { method: "DELETE" });
	}

	function toggleScholarBoost(nextValue: boolean) {
		if (nextValue && !boostUnlocked) {
			setError(
				boostAvailable
					? "Scholar Boost appears after your first generated exam."
					: "Scholar Boost has already been used.",
			);
			return;
		}

		setUseScholarBoost(nextValue);
		setError(null);

		if (!nextValue && tier === "free") {
			setMode("standard");
			setQuestionCount((current) => Math.min(current, TIER_MAX_QUESTIONS_PER_EXAM.free));
		}
	}

	function selectMode(nextMode: "standard" | "power") {
		if (nextMode === "power" && effectiveTier === "free") {
			if (boostUnlocked) {
				toggleScholarBoost(true);
			} else {
				setError("Power Mode is available on Scholar and Guru.");
				return;
			}
		}

		if (nextMode === "power" && !boostUnlocked && tier === "free") {
			return;
		}

		setError(null);
		setMode(nextMode);

		if (nextMode === "power" && powerSlots.length === 0) {
			setPowerSlots([createPowerSlot(topics[0] ?? "")]);
		}
	}

	function updatePowerSlot(slotIdValue: string, update: Partial<PowerQuestionSlot>) {
		setPowerSlots((current) =>
			current.map((slot) => (slot.id === slotIdValue ? { ...slot, ...update } : slot)),
		);
	}

	function addPowerSlot(topic = topics[0] ?? "") {
		setPowerSlots((current) =>
			current.length >= maxQuestions ? current : [...current, createPowerSlot(topic)],
		);
	}

	function duplicatePowerSlot(slotIdValue: string) {
		setPowerSlots((current) => {
			const index = current.findIndex((slot) => slot.id === slotIdValue);
			if (index === -1) {
				return current;
			}

			const copy = { ...current[index], id: slotId() };
			return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
		});
	}

	function removePowerSlot(slotIdValue: string) {
		setPowerSlots((current) => current.filter((slot) => slot.id !== slotIdValue));
	}

	function movePowerSlot(slotIdValue: string, direction: -1 | 1) {
		setPowerSlots((current) => {
			const index = current.findIndex((slot) => slot.id === slotIdValue);
			const targetIndex = index + direction;
			if (index === -1 || targetIndex < 0 || targetIndex >= current.length) {
				return current;
			}

			const next = [...current];
			const target = next[targetIndex];
			next[targetIndex] = next[index];
			next[index] = target;
			return next;
		});
	}

	function setAllPowerSlots(update: Partial<PowerQuestionSlot>) {
		setPowerSlots((current) => current.map((slot) => ({ ...slot, ...update })));
	}

	function quickAddPowerSlots() {
		const topic = quickTopic.trim() || topics[0] || "Selected course topic";
		const count = Math.max(1, Math.min(20, quickCount));
		const nextSlots = Array.from({ length: count }, () => ({
			...createPowerSlot(topic),
			style: quickStyle,
			difficulty: quickDifficulty,
			points: quickPoints,
		}));

		setPowerSlots((current) => [...current, ...nextSlots].slice(0, maxQuestions));
	}

	function applyRangeUpdate() {
		const start = Math.max(1, Math.min(rangeStart, rangeEnd));
		const end = Math.min(powerSlots.length, Math.max(rangeStart, rangeEnd));
		const update: Partial<PowerQuestionSlot> = {
			style: rangeStyle,
			difficulty: rangeDifficulty,
			points: rangePoints,
		};

		if (rangeTopic.trim()) {
			update.topic = rangeTopic.trim();
		}

		setPowerSlots((current) =>
			current.map((slot, index) =>
				index + 1 >= start && index + 1 <= end ? { ...slot, ...update } : slot,
			),
		);
	}

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
					adHocUploadIds: sourceUploads.map((upload) => upload.id),
					topics,
					sourceNotes,
					questionCount: configuredQuestionCount,
					mode,
					powerSlots: mode === "power" ? toServerPowerSlots(powerSlots) : undefined,
					mirrorInstructorStyle,
					useScholarBoost,
				}),
			});
			const payload = (await response.json()) as { examId?: string; error?: string };

			if (!response.ok || !payload.examId) {
				throw new Error(payload.error ?? "Exam creation failed.");
			}

			window.localStorage.removeItem(draftStorageKey);
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
			<div className="rounded-lg border border-glass-border bg-background/35 p-4">
				<div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
					<div>
						<h2 className="text-sm font-medium">One-time source files</h2>
						<p className="mt-1 text-sm text-muted">
							Upload files for this exam only. They will be preserved on the exam
							record, not added to a class library.
						</p>
					</div>
					<label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white">
						<FileUp aria-hidden="true" size={18} />
						{isUploadingSource ? "Uploading" : "Upload files"}
						<input
							type="file"
							multiple
							onChange={onSourceFilesSelected}
							disabled={isUploadingSource}
							className="sr-only"
						/>
					</label>
				</div>
				<div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
					<label className="text-sm">
						<span className="font-medium">Focus for next upload</span>
						<input
							value={uploadFocus}
							onChange={(event) => setUploadFocus(event.target.value)}
							className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
							placeholder="Chapters 7-9, Unit 4, thermodynamics only"
							maxLength={500}
						/>
					</label>
					<label className="flex items-center gap-2 self-end rounded-lg border border-glass-border bg-background/45 px-3 py-3 text-sm">
						<input
							type="checkbox"
							checked={uploadStyleReference}
							onChange={(event) => setUploadStyleReference(event.target.checked)}
						/>
						Style reference
					</label>
				</div>
				{sourceUploads.length > 0 ? (
					<ul className="mt-4 space-y-2">
						{sourceUploads.map((upload) => (
							<li
								key={upload.id}
								className="flex flex-col justify-between gap-3 rounded-lg border border-glass-border bg-background/50 p-3 text-sm md:flex-row md:items-center"
							>
								<div>
									<p className="font-medium">{upload.filename}</p>
									<p className="text-muted" role="status" aria-live="polite">
										{Math.max(1, Math.round(upload.sizeBytes / 1024))} KB -{" "}
										{uploadStatusText(upload)}
									</p>
									{upload.focus ? (
										<p className="mt-1 text-muted">Focus: {upload.focus}</p>
									) : null}
									{upload.extractedTopics.length > 0 ? (
										<p className="mt-1 text-muted">
											{upload.extractedTopics.length} topics extracted
										</p>
									) : null}
									{upload.extractionProgress ? (
										<div className="mt-2 max-w-xl">
											<div className="flex items-center justify-between gap-3 text-xs text-muted">
												<span>{upload.extractionProgress.detail}</span>
												<span>{upload.extractionProgress.percent}%</span>
											</div>
											<div
												className="mt-1 h-2 overflow-hidden rounded-full bg-glass"
												role="progressbar"
												aria-label={`${upload.filename} extraction progress`}
												aria-valuenow={upload.extractionProgress.percent}
												aria-valuemin={0}
												aria-valuemax={100}
											>
												<div
													className="h-full bg-secondary"
													style={{
														width: `${upload.extractionProgress.percent}%`,
													}}
												/>
											</div>
											{uploadPageProgressText(upload.extractionProgress) ? (
												<p className="mt-1 text-xs text-muted">
													{uploadPageProgressText(
														upload.extractionProgress,
													)}
												</p>
											) : null}
										</div>
									) : null}
								</div>
								<div className="flex items-center gap-2">
									{uploadIsExtracting(upload) ? (
										<RefreshCw
											aria-label="Extracting topics"
											className="animate-spin text-secondary"
											size={18}
										/>
									) : null}
									<button
										type="button"
										className="rounded-lg p-2 text-error hover:bg-error/10"
										onClick={() => void removeSourceUpload(upload.id)}
									>
										<Trash2 aria-label="Remove source upload" size={18} />
									</button>
								</div>
							</li>
						))}
					</ul>
				) : null}
			</div>
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
				<p className="mt-2 text-sm text-muted" role="status" aria-live="polite">
					{topics.length} topics ready
				</p>
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
			{tier === "free" && boostAvailable ? (
				<label className="flex items-start gap-3 rounded-lg border border-premium/40 bg-premium/10 p-4 text-sm">
					<input
						type="checkbox"
						checked={useScholarBoost}
						disabled={!boostUnlocked}
						onChange={(event) => toggleScholarBoost(event.target.checked)}
						className="mt-1"
					/>
					<span>
						<span className="font-semibold text-foreground">
							Boost this exam to Scholar for free
						</span>
						<span className="mt-1 block text-muted">
							{boostUnlocked
								? "Unlock up to 25 questions, Power Mode, answer key access, and one grading round for this exam."
								: "Your once-per-account Scholar Boost appears after your first generated exam."}
						</span>
					</span>
				</label>
			) : null}
			<div className="grid gap-4 md:grid-cols-[1fr_220px]">
				<div className="rounded-lg border border-glass-border bg-background/40 p-4">
					<div className="flex items-center justify-between">
						<label className="text-sm font-medium" htmlFor="question-count">
							Questions
						</label>
						<span className="text-sm text-muted">Max {maxQuestions} on your tier</span>
					</div>
					{mode === "standard" ? (
						<>
							<input
								id="question-count"
								type="range"
								min={1}
								max={maxQuestions}
								value={questionCount}
								onChange={(event) => setQuestionCount(Number(event.target.value))}
								className="mt-4 h-11 w-full accent-brand"
							/>
							<p className="mt-2 text-2xl font-semibold">{questionCount}</p>
						</>
					) : (
						<div className="mt-4 flex items-center justify-between gap-3">
							<p className="text-2xl font-semibold">{powerSlots.length}</p>
							<Button
								type="button"
								onClick={() => addPowerSlot()}
								disabled={powerSlots.length >= maxQuestions}
							>
								<Plus aria-hidden="true" size={16} />
								Add slot
							</Button>
						</div>
					)}
				</div>
				<div className="rounded-lg border border-glass-border bg-background/40 p-4">
					<p className="text-sm font-medium">Mode</p>
					<div className="mt-3 grid grid-cols-2 gap-2">
						<button
							type="button"
							className={`min-h-11 rounded-lg border px-3 py-2 text-sm ${
								mode === "standard"
									? "border-brand bg-brand text-white"
									: "border-glass-border bg-background/60"
							}`}
							onClick={() => selectMode("standard")}
						>
							Standard
						</button>
						<button
							type="button"
							className={`min-h-11 rounded-lg border px-3 py-2 text-sm ${
								mode === "power"
									? "border-premium bg-premium text-premium-foreground"
									: "border-glass-border bg-background/60"
							}`}
							onClick={() => selectMode("power")}
						>
							Power
						</button>
					</div>
				</div>
			</div>
			{mode === "power" ? (
				<div className="space-y-4 rounded-lg border border-glass-border bg-background/35 p-4">
					<div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
						<div>
							<h2 className="text-lg font-semibold">Power Mode slots</h2>
							<p className="text-sm text-muted">
								{powerSlots.length} configured of {maxQuestions} available.
							</p>
						</div>
						{selectedClass?.styleGuide ? (
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={mirrorInstructorStyle}
									onChange={(event) =>
										setMirrorInstructorStyle(event.target.checked)
									}
								/>
								Mirror instructor style
							</label>
						) : null}
					</div>
					<datalist id="power-topic-options">
						{topics.map((topic) => (
							<option key={topic} value={topic} />
						))}
					</datalist>
					<div className="grid gap-3 lg:grid-cols-[1.2fr_120px_150px_130px_90px_auto]">
						<input
							value={quickTopic}
							onChange={(event) => setQuickTopic(event.target.value)}
							list="power-topic-options"
							placeholder="Quick-add topic"
							aria-label="Quick-add topic"
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						/>
						<input
							type="number"
							min={1}
							max={20}
							value={quickCount}
							onChange={(event) => setQuickCount(Number(event.target.value))}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
							aria-label="Quick-add count"
						/>
						<select
							aria-label="Quick-add style"
							value={quickStyle}
							onChange={(event) => setQuickStyle(event.target.value as QuestionStyle)}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						>
							{styleOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						<select
							aria-label="Quick-add difficulty"
							value={quickDifficulty}
							onChange={(event) =>
								setQuickDifficulty(event.target.value as QuestionDifficulty)
							}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						>
							{difficultyOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						<input
							type="number"
							min={1}
							max={100}
							value={quickPoints}
							onChange={(event) => setQuickPoints(Number(event.target.value))}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
							aria-label="Quick-add points"
						/>
						<Button
							type="button"
							onClick={quickAddPowerSlots}
							disabled={powerSlots.length >= maxQuestions}
						>
							<ListPlus aria-hidden="true" size={16} />
							Quick-add
						</Button>
					</div>
					<div className="grid gap-3 rounded-lg border border-glass-border bg-background/45 p-3 lg:grid-cols-[80px_80px_1fr_150px_130px_90px_auto]">
						<input
							type="number"
							min={1}
							max={Math.max(1, powerSlots.length)}
							value={rangeStart}
							onChange={(event) => setRangeStart(Number(event.target.value))}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
							aria-label="Range start"
						/>
						<input
							type="number"
							min={1}
							max={Math.max(1, powerSlots.length)}
							value={rangeEnd}
							onChange={(event) => setRangeEnd(Number(event.target.value))}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
							aria-label="Range end"
						/>
						<input
							value={rangeTopic}
							onChange={(event) => setRangeTopic(event.target.value)}
							list="power-topic-options"
							placeholder="Range topic"
							aria-label="Range topic"
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						/>
						<select
							aria-label="Range style"
							value={rangeStyle}
							onChange={(event) => setRangeStyle(event.target.value as QuestionStyle)}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						>
							{styleOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						<select
							aria-label="Range difficulty"
							value={rangeDifficulty}
							onChange={(event) =>
								setRangeDifficulty(event.target.value as QuestionDifficulty)
							}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						>
							{difficultyOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						<input
							type="number"
							min={1}
							max={100}
							value={rangePoints}
							onChange={(event) => setRangePoints(Number(event.target.value))}
							className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
							aria-label="Range points"
						/>
						<Button
							type="button"
							onClick={applyRangeUpdate}
							disabled={powerSlots.length === 0}
						>
							Apply range
						</Button>
					</div>
					<div className="space-y-3">
						{powerSlots.map((slot, index) => (
							<div
								key={slot.id}
								className="grid gap-3 rounded-lg border border-glass-border bg-background/55 p-3 lg:grid-cols-[44px_1fr_150px_130px_92px_160px]"
							>
								<div className="flex h-11 items-center justify-center rounded-lg bg-glass text-sm font-semibold">
									{index + 1}
								</div>
								<input
									value={slot.topic}
									onChange={(event) =>
										updatePowerSlot(slot.id, { topic: event.target.value })
									}
									list="power-topic-options"
									placeholder="Question topic"
									aria-label={`Question ${index + 1} topic`}
									className="h-11 rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
								/>
								<div className="space-y-2">
									<select
										aria-label={`Question ${index + 1} style`}
										value={slot.style}
										onChange={(event) =>
											updatePowerSlot(slot.id, {
												style: event.target.value as QuestionStyle,
											})
										}
										className="h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
									>
										{styleOptions.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
									<button
										type="button"
										className="text-xs text-muted hover:text-foreground"
										onClick={() => setAllPowerSlots({ style: slot.style })}
									>
										Set all
									</button>
								</div>
								<div className="space-y-2">
									<select
										aria-label={`Question ${index + 1} difficulty`}
										value={slot.difficulty}
										onChange={(event) =>
											updatePowerSlot(slot.id, {
												difficulty: event.target
													.value as QuestionDifficulty,
											})
										}
										className="h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
									>
										{difficultyOptions.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
									<button
										type="button"
										className="text-xs text-muted hover:text-foreground"
										onClick={() =>
											setAllPowerSlots({ difficulty: slot.difficulty })
										}
									>
										Set all
									</button>
								</div>
								<div className="space-y-2">
									<input
										type="number"
										min={1}
										max={100}
										value={slot.points}
										onChange={(event) =>
											updatePowerSlot(slot.id, {
												points: Number(event.target.value),
											})
										}
										className="h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
										aria-label={`Question ${index + 1} points`}
									/>
									<button
										type="button"
										className="text-xs text-muted hover:text-foreground"
										onClick={() => setAllPowerSlots({ points: slot.points })}
									>
										Set all
									</button>
								</div>
								<div className="flex items-start justify-end gap-1">
									<button
										type="button"
										className="rounded-lg p-2 text-muted hover:bg-glass hover:text-foreground"
										onClick={() => movePowerSlot(slot.id, -1)}
										disabled={index === 0}
										aria-label={`Move question ${index + 1} up`}
									>
										<ArrowUp aria-hidden="true" size={16} />
									</button>
									<button
										type="button"
										className="rounded-lg p-2 text-muted hover:bg-glass hover:text-foreground"
										onClick={() => movePowerSlot(slot.id, 1)}
										disabled={index === powerSlots.length - 1}
										aria-label={`Move question ${index + 1} down`}
									>
										<ArrowDown aria-hidden="true" size={16} />
									</button>
									<button
										type="button"
										className="rounded-lg p-2 text-muted hover:bg-glass hover:text-foreground"
										onClick={() => duplicatePowerSlot(slot.id)}
										disabled={powerSlots.length >= maxQuestions}
										aria-label={`Duplicate question ${index + 1}`}
									>
										<Copy aria-hidden="true" size={16} />
									</button>
									<button
										type="button"
										className="rounded-lg p-2 text-error hover:bg-error/10"
										onClick={() => removePowerSlot(slot.id)}
										aria-label={`Remove question ${index + 1}`}
									>
										<Trash2 aria-hidden="true" size={16} />
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			) : null}
			{error ? (
				<p className="rounded-lg bg-error/10 p-3 text-sm text-error" role="alert">
					{error}
				</p>
			) : null}
			<div className="flex flex-col justify-between gap-3 rounded-lg border border-glass-border bg-glass p-4 sm:flex-row sm:items-center">
				<div>
					<p className="text-sm text-muted">Generation cost</p>
					<p className="text-2xl font-semibold">
						{useScholarBoost ? "Scholar Boost" : `${cost} credits`}
					</p>
					{useScholarBoost ? (
						<p className="mt-1 text-sm text-muted">{rawCost} credits waived</p>
					) : null}
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
