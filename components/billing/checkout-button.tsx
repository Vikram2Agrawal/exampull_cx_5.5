"use client";

import { CreditCard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CheckoutSku } from "@/lib/billing/stripe";

export function CheckoutButton({
	sku,
	children,
	variant = "secondary",
}: {
	sku: CheckoutSku;
	children: React.ReactNode;
	variant?: "secondary" | "premium" | "primary";
}) {
	const [isLoading, setIsLoading] = useState(false);

	async function onClick() {
		setIsLoading(true);

		try {
			const response = await fetch("/api/billing/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sku }),
			});
			const payload = (await response.json()) as { url?: string; error?: string };

			if (!response.ok || !payload.url) {
				throw new Error(payload.error ?? "Checkout could not start.");
			}

			window.location.assign(payload.url);
		} catch (error) {
			window.alert(error instanceof Error ? error.message : "Checkout could not start.");
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Button
			type="button"
			variant={variant}
			className="mt-5"
			onClick={onClick}
			disabled={isLoading}
		>
			<CreditCard aria-hidden="true" size={18} />
			{isLoading ? "Opening checkout" : children}
		</Button>
	);
}
