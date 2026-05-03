"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
	open: boolean;
	title: string;
	children: ReactNode;
	confirmLabel: string;
	cancelLabel?: string;
	variant?: "danger" | "primary";
	confirmDisabled?: boolean;
	onConfirm: () => void;
	onClose: () => void;
};

export function ConfirmDialog({
	open,
	title,
	children,
	confirmLabel,
	cancelLabel = "Cancel",
	variant = "danger",
	confirmDisabled = false,
	onConfirm,
	onClose,
}: ConfirmDialogProps) {
	const titleId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const cancelButtonRef = useRef<HTMLButtonElement>(null);
	const confirmButtonRef = useRef<HTMLButtonElement>(null);
	const priorFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}

		priorFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		cancelButtonRef.current?.focus();

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onClose();
				return;
			}

			if (event.key !== "Tab" || !panelRef.current) {
				return;
			}

			const focusables = [
				cancelButtonRef.current,
				confirmButtonRef.current,
				closeButtonRef.current,
			]
				.filter((element): element is HTMLButtonElement => Boolean(element))
				.filter((element) => !element.disabled);
			if (focusables.length === 0) {
				return;
			}

			event.preventDefault();
			const currentIndex =
				document.activeElement instanceof HTMLButtonElement
					? focusables.indexOf(document.activeElement)
					: -1;
			const nextIndex = event.shiftKey
				? (currentIndex <= 0 ? focusables.length : currentIndex) - 1
				: currentIndex === -1 || currentIndex === focusables.length - 1
					? 0
					: currentIndex + 1;
			focusables[nextIndex]?.focus();
		}

		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", onKeyDown);

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", onKeyDown);
			priorFocusRef.current?.focus();
		};
	}, [open, onClose]);

	if (!open) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-4">
			<div
				ref={panelRef}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className="w-full rounded-t-xl border border-glass-border bg-background p-5 shadow-glass sm:max-w-md sm:rounded-xl"
			>
				<div className="flex items-start justify-between gap-4">
					<h2 id={titleId} className="text-xl font-semibold">
						{title}
					</h2>
					<button
						ref={closeButtonRef}
						type="button"
						aria-label="Close dialog"
						className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-glass hover:text-foreground"
						onClick={onClose}
					>
						<X aria-hidden="true" size={18} />
					</button>
				</div>
				<div className="mt-4 text-sm leading-6 text-muted">{children}</div>
				<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button ref={cancelButtonRef} type="button" variant="ghost" onClick={onClose}>
						{cancelLabel}
					</Button>
					<Button
						ref={confirmButtonRef}
						type="button"
						variant={variant === "danger" ? "danger" : "primary"}
						disabled={confirmDisabled}
						onClick={onConfirm}
					>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}
