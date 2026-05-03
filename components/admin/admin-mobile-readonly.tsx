"use client";

import { useEffect } from "react";

const readonlyQuery = "(max-width: 1023px)";
const controlSelector = "button, input, select, textarea";

type DisableableControl =
	| HTMLButtonElement
	| HTMLInputElement
	| HTMLSelectElement
	| HTMLTextAreaElement;

function isDisableableControl(element: Element): element is DisableableControl {
	return (
		element instanceof HTMLButtonElement ||
		element instanceof HTMLInputElement ||
		element instanceof HTMLSelectElement ||
		element instanceof HTMLTextAreaElement
	);
}

function controlsIn(root: HTMLElement) {
	return Array.from(root.querySelectorAll(controlSelector)).filter(isDisableableControl);
}

function applyReadOnly(root: HTMLElement, readOnly: boolean) {
	for (const control of controlsIn(root)) {
		if (readOnly) {
			if (!control.dataset.adminOriginalDisabled) {
				control.dataset.adminOriginalDisabled = control.disabled ? "true" : "false";
			}
			control.disabled = true;
			control.setAttribute("aria-disabled", "true");
		} else {
			const originalDisabled = control.dataset.adminOriginalDisabled;
			if (originalDisabled) {
				control.disabled = originalDisabled === "true";
				delete control.dataset.adminOriginalDisabled;
			}
			control.removeAttribute("aria-disabled");
		}
	}
}

export function AdminMobileReadOnly({ rootId }: { rootId: string }) {
	useEffect(() => {
		const root = document.getElementById(rootId);
		if (!root) {
			return;
		}
		const rootElement = root;

		const media = window.matchMedia(readonlyQuery);

		function update() {
			applyReadOnly(rootElement, media.matches);
		}

		const observer = new MutationObserver(update);
		observer.observe(rootElement, { childList: true, subtree: true });
		update();
		media.addEventListener("change", update);

		return () => {
			media.removeEventListener("change", update);
			observer.disconnect();
			applyReadOnly(rootElement, false);
		};
	}, [rootId]);

	return null;
}
