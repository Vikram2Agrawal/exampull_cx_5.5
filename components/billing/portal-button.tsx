"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PortalButton() {
	const [isLoading, setIsLoading] = useState(false);

	async function onClick() {
		setIsLoading(true);

		try {
			const response = await fetch("/api/billing/portal", { method: "POST" });
			const payload = (await response.json()) as { url?: string; error?: string };

			if (!response.ok || !payload.url) {
				throw new Error(payload.error ?? "Billing portal could not open.");
			}

			window.location.assign(payload.url);
		} catch (error) {
			window.alert(error instanceof Error ? error.message : "Billing portal could not open.");
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Button type="button" onClick={onClick} disabled={isLoading}>
			<Settings aria-hidden="true" size={18} />
			{isLoading ? "Opening portal" : "Manage subscription"}
		</Button>
	);
}
