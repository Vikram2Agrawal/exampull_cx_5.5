import Stripe from "stripe";
import { env, publicBaseUrl } from "@/lib/env";

export type CheckoutSku =
	| "scholar_monthly"
	| "scholar_annual"
	| "guru_monthly"
	| "guru_annual"
	| "credits_20"
	| "credits_100"
	| "credits_240";

type CheckoutConfig = {
	priceId?: string;
	mode: "payment" | "subscription";
	metadata: Record<string, string>;
};

export const checkoutCatalog: Record<CheckoutSku, CheckoutConfig> = {
	scholar_monthly: {
		priceId: env.STRIPE_PRICE_SCHOLAR_MONTHLY,
		mode: "subscription",
		metadata: { purchaseType: "subscription", tier: "scholar", interval: "month" },
	},
	scholar_annual: {
		priceId: env.STRIPE_PRICE_SCHOLAR_ANNUAL,
		mode: "subscription",
		metadata: { purchaseType: "subscription", tier: "scholar", interval: "year" },
	},
	guru_monthly: {
		priceId: env.STRIPE_PRICE_GURU_MONTHLY,
		mode: "subscription",
		metadata: { purchaseType: "subscription", tier: "guru", interval: "month" },
	},
	guru_annual: {
		priceId: env.STRIPE_PRICE_GURU_ANNUAL,
		mode: "subscription",
		metadata: { purchaseType: "subscription", tier: "guru", interval: "year" },
	},
	credits_20: {
		priceId: env.STRIPE_PRICE_CREDITS_20,
		mode: "payment",
		metadata: { purchaseType: "credits", credits: "20" },
	},
	credits_100: {
		priceId: env.STRIPE_PRICE_CREDITS_100,
		mode: "payment",
		metadata: { purchaseType: "credits", credits: "100" },
	},
	credits_240: {
		priceId: env.STRIPE_PRICE_CREDITS_240,
		mode: "payment",
		metadata: { purchaseType: "credits", credits: "240" },
	},
};

export function stripeClient() {
	if (!env.STRIPE_SECRET_KEY) {
		throw new Error("Stripe is not configured.");
	}

	return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-10-29.clover" });
}

export function checkoutUrls() {
	const baseUrl = publicBaseUrl();

	return {
		success_url: `${baseUrl}/billing?checkout=success`,
		cancel_url: `${baseUrl}/billing?checkout=cancelled`,
	};
}
