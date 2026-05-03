"use client";

import { HelpCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FeaturebaseWidgetOptions = {
	organization: string;
	theme: "light" | "dark";
	featurebaseJwt?: string;
	email?: string;
	locale: "en";
	metadata: {
		surface: string;
	};
};

type FeaturebaseIdentifyOptions = {
	organization: string;
	featurebaseJwt: string;
};

type FeaturebaseCallback = (error?: unknown, callback?: { action?: string }) => void;
type FeaturebaseCommand =
	| ["initialize_feedback_widget", FeaturebaseWidgetOptions, FeaturebaseCallback?]
	| ["identify", FeaturebaseIdentifyOptions, FeaturebaseCallback?];

type FeaturebaseFunction = {
	(...args: FeaturebaseCommand): void;
	q?: FeaturebaseCommand[];
};

declare global {
	interface Window {
		Featurebase?: FeaturebaseFunction;
	}
}

type FeaturebaseSession = {
	configured?: boolean;
	organization?: string | null;
	featurebaseJwt?: string | null;
	hasUnreadChangelog?: boolean;
};

function ensureFeaturebaseSdk() {
	if (typeof window.Featurebase !== "function") {
		const queued = ((...args: FeaturebaseCommand) => {
			queued.q = [...(queued.q ?? []), args];
		}) as FeaturebaseFunction;
		window.Featurebase = queued;
	}

	if (!document.getElementById("featurebase-sdk")) {
		const script = document.createElement("script");
		script.id = "featurebase-sdk";
		script.src = "https://do.featurebase.app/js/sdk.js";
		script.async = true;
		document.head.appendChild(script);
	}
}

export function FeaturebaseHelpButton({
	theme = "system",
}: {
	theme?: "system" | "light" | "dark";
}) {
	const [open, setOpen] = useState(false);
	const [session, setSession] = useState<FeaturebaseSession | null>(null);
	const [sdkInitialized, setSdkInitialized] = useState(false);
	const [hasUnreadChangelog, setHasUnreadChangelog] = useState(false);
	const titleId = useId();
	const dialogRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const closeRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		let active = true;

		async function loadSession() {
			const response = await fetch("/api/featurebase/session");
			if (!response.ok) {
				return;
			}

			const session = (await response.json()) as FeaturebaseSession;
			if (!active) {
				return;
			}

			setHasUnreadChangelog(Boolean(session.hasUnreadChangelog));
			setSession(session);
		}

		void loadSession();

		return () => {
			active = false;
		};
	}, []);

	function initializeFeaturebase() {
		if (sdkInitialized || !session?.configured || !session.organization) {
			return;
		}

		ensureFeaturebaseSdk();
		const featurebaseJwt = session.featurebaseJwt ?? undefined;

		if (featurebaseJwt) {
			window.Featurebase?.("identify", {
				organization: session.organization,
				featurebaseJwt,
			});
		}

		window.Featurebase?.("initialize_feedback_widget", {
			organization: session.organization,
			theme: theme === "dark" ? "dark" : "light",
			featurebaseJwt,
			locale: "en",
			metadata: {
				surface: "app_help_button",
			},
		});
		setSdkInitialized(true);
	}

	useEffect(() => {
		if (!open) {
			return;
		}

		closeRef.current?.focus();

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setOpen(false);
				return;
			}

			if (event.key !== "Tab" || !dialogRef.current) {
				return;
			}

			const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
			);
			const focusables = Array.from(focusableElements);
			if (focusables.length === 0) {
				return;
			}

			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}

		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", onKeyDown);

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", onKeyDown);
			triggerRef.current?.focus();
		};
	}, [open]);

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				aria-label={
					hasUnreadChangelog
						? "Open help and feedback, unread changelog"
						: "Open help and feedback"
				}
				className="fixed bottom-5 right-5 z-40 hidden h-12 w-12 items-center justify-center rounded-full border border-glass-border bg-glass-strong text-foreground shadow-glass md:flex"
				onClick={() => {
					initializeFeaturebase();
					setOpen(true);
				}}
			>
				<HelpCircle aria-hidden="true" size={20} />
				<span
					className={cn(
						"absolute right-1 top-1 h-3 w-3 rounded-full bg-premium ring-2 ring-background",
						!hasUnreadChangelog && "hidden",
					)}
				/>
			</button>
			{open ? (
				<div className="fixed inset-0 z-50 bg-black/40">
					<div
						ref={dialogRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						className="absolute bottom-0 right-0 max-h-[88vh] w-full overflow-y-auto border-t border-glass-border bg-background p-5 shadow-glass sm:bottom-5 sm:right-5 sm:w-[420px] sm:rounded-lg sm:border"
					>
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="text-sm font-semibold text-secondary">
									Help & Feedback
								</p>
								<h2 id={titleId} className="mt-1 text-xl font-semibold">
									Send a note
								</h2>
							</div>
							<button
								ref={closeRef}
								type="button"
								aria-label="Close help and feedback"
								className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-glass"
								onClick={() => setOpen(false)}
							>
								<X aria-hidden="true" size={18} />
							</button>
						</div>
						<div className="mt-5">
							<FeedbackForm
								source="in_app_widget"
								onSubmitted={() => setHasUnreadChangelog(false)}
							/>
						</div>
						<div className="mt-5 grid gap-2 border-t border-glass-border pt-4 sm:grid-cols-2">
							<Button type="button" onClick={() => setOpen(false)}>
								Done
							</Button>
							<a
								href="/changelog"
								className="inline-flex min-h-11 items-center justify-center rounded-lg border border-glass-border px-4 text-sm font-semibold text-secondary"
							>
								What changed
							</a>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
