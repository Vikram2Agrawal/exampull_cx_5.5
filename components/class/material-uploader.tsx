"use client";

import { FileUp, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusMessage } from "@/components/ui/surface";
import type { MaterialSummary } from "@/lib/classes/data";

type UploadStartResponse = {
	materialId?: string;
	uploadUrl?: string;
	error?: string;
};

const maxUploadBytes = 100 * 1024 * 1024;

export function MaterialUploader({
	classId,
	materials,
}: {
	classId: string;
	materials: MaterialSummary[];
}) {
	const router = useRouter();
	const [file, setFile] = useState<File | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [focus, setFocus] = useState("");
	const [styleReference, setStyleReference] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [materialToDelete, setMaterialToDelete] = useState<MaterialSummary | null>(null);

	function onFileChange(event: ChangeEvent<HTMLInputElement>) {
		setFile(event.target.files?.[0] ?? null);
		setError(null);
	}

	function clearSelectedFile() {
		setFile(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!file) {
			setError("Choose a file first.");
			return;
		}

		if (file.size > maxUploadBytes) {
			setError("Uploads are capped at 100 MB per file.");
			return;
		}

		setIsUploading(true);
		setError(null);

		try {
			const startResponse = await fetch(`/api/classes/${classId}/materials`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					filename: file.name,
					contentType: file.type || "application/octet-stream",
					sizeBytes: file.size,
					focus,
					styleReference,
				}),
			});
			const startPayload = (await startResponse.json()) as UploadStartResponse;

			if (!startResponse.ok || !startPayload.uploadUrl || !startPayload.materialId) {
				throw new Error(startPayload.error ?? "Could not start upload.");
			}

			const uploadResponse = await fetch(startPayload.uploadUrl, {
				method: "PUT",
				headers: { "Content-Type": file.type || "application/octet-stream" },
				body: file,
			});

			if (!uploadResponse.ok) {
				throw new Error("Storage upload failed.");
			}

			const completeResponse = await fetch(
				`/api/classes/${classId}/materials/${startPayload.materialId}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status: "uploaded" }),
				},
			);

			if (!completeResponse.ok) {
				const payload = (await completeResponse.json()) as { error?: string };
				throw new Error(payload.error ?? "Upload completion failed.");
			}

			setFile(null);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			setFocus("");
			setStyleReference(false);
			router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Upload failed.");
		} finally {
			setIsUploading(false);
		}
	}

	async function deleteMaterial() {
		if (!materialToDelete) {
			return;
		}

		await fetch(`/api/classes/${classId}/materials/${materialToDelete.id}`, {
			method: "DELETE",
		});
		setMaterialToDelete(null);
		router.refresh();
	}

	return (
		<div className="space-y-5">
			<form
				className="space-y-4 rounded-lg border border-glass-border bg-background/35 p-4"
				onSubmit={onSubmit}
			>
				<div>
					<input
						ref={fileInputRef}
						id="material"
						aria-label="Material file"
						type="file"
						onChange={onFileChange}
						className="sr-only"
					/>
					{file ? (
						<div className="rounded-xl border border-glass-border bg-background/45 p-4">
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">{file.name}</p>
									<p className="mt-1 text-xs text-muted">
										{Math.max(1, Math.round(file.size / 1024))} KB selected
									</p>
								</div>
								<button
									type="button"
									aria-label="Remove selected material file"
									className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-glass hover:text-foreground"
									onClick={clearSelectedFile}
								>
									<X aria-hidden="true" size={18} />
								</button>
							</div>
						</div>
					) : (
						<label
							htmlFor="material"
							className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-glass-border bg-background/45 p-5 text-center transition hover:border-brand/60 hover:bg-brand/10"
						>
							<span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand">
								<FileUp aria-hidden="true" size={22} />
							</span>
							<span className="mt-4 text-sm font-semibold">Choose material file</span>
							<span className="mt-1 max-w-sm text-xs leading-5 text-muted">
								PDFs, slides, notes, photos, and source documents. 100 MB max.
							</span>
						</label>
					)}
				</div>
				<div>
					<label className="text-sm font-medium" htmlFor="focus">
						Focus
					</label>
					<input
						id="focus"
						value={focus}
						onChange={(event) => setFocus(event.target.value)}
						className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						placeholder="Unit 4, chapters 7-9, final exam format"
						maxLength={500}
					/>
				</div>
				<label className="flex items-start gap-3 rounded-lg border border-glass-border bg-background/50 p-3 text-sm">
					<input
						type="checkbox"
						checked={styleReference}
						onChange={(event) => setStyleReference(event.target.checked)}
						className="mt-1"
					/>
					<span>
						<span className="font-medium">Instructor style reference</span>
						<span className="block text-muted">
							Use this as a past-exam example and spend 2 credits to update the class
							style guide.
						</span>
					</span>
				</label>
				{error ? <StatusMessage variant="error">{error}</StatusMessage> : null}
				<Button type="submit" variant="primary" disabled={isUploading || !file}>
					<FileUp aria-hidden="true" size={18} />
					{isUploading ? "Uploading" : file ? "Upload material" : "Choose a file first"}
				</Button>
			</form>
			<div className="space-y-3">
				{materials.length === 0 ? (
					<p className="rounded-lg border border-dashed border-glass-border p-5 text-sm text-muted">
						No materials yet.
					</p>
				) : (
					materials.map((material) => (
						<div
							key={material.id}
							className="rounded-lg border border-glass-border bg-background/35 p-4"
						>
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="font-medium">{material.filename}</p>
									<p className="mt-1 text-sm text-muted">
										{Math.max(1, Math.round(material.sizeBytes / 1024))} KB -{" "}
										{material.status.replaceAll("_", " ")}
									</p>
								</div>
								<button
									type="button"
									aria-label={`Delete ${material.filename}`}
									className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-glass"
									onClick={() => setMaterialToDelete(material)}
								>
									<Trash2 aria-hidden="true" size={18} />
								</button>
							</div>
							{material.styleReference ? (
								<p className="mt-3 inline-flex items-center gap-2 rounded-full bg-premium/20 px-3 py-1 text-xs text-premium-foreground">
									<Sparkles aria-hidden="true" size={14} />
									Style reference
								</p>
							) : null}
							{material.extractedTopics.length > 0 ? (
								<div className="mt-3 flex flex-wrap gap-2">
									{material.extractedTopics.map((topic) => (
										<span
											key={topic}
											className="rounded-full border border-glass-border px-3 py-1 text-xs"
										>
											{topic}
										</span>
									))}
								</div>
							) : null}
						</div>
					))
				)}
			</div>
			<ConfirmDialog
				open={Boolean(materialToDelete)}
				title="Delete this material?"
				confirmLabel="Delete material"
				onClose={() => setMaterialToDelete(null)}
				onConfirm={() => void deleteMaterial()}
			>
				<p>
					{materialToDelete?.filename} will be removed from this class and cannot be used
					for future exams. Existing generated exams are not changed.
				</p>
			</ConfirmDialog>
		</div>
	);
}
