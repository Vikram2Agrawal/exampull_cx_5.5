import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeClient } from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import { adminDb, Timestamp } from "@/lib/firebase/admin";
import { TIER_MONTHLY_CREDITS, type Tier } from "@/lib/product/constants";

export const runtime = "nodejs";

function tierFromMetadata(value: string | undefined): Tier | null {
	if (value === "scholar" || value === "guru") {
		return value;
	}

	return null;
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
	const userId = session.metadata?.userId;

	if (!userId) {
		return;
	}

	const userRef = adminDb.collection("users").doc(userId);
	const purchaseType = session.metadata?.purchaseType;

	if (purchaseType === "credits") {
		const credits = Number(session.metadata?.credits ?? 0);
		if (credits <= 0) {
			return;
		}

		await adminDb.runTransaction(async (transaction) => {
			const user = await transaction.get(userRef);
			transaction.update(userRef, {
				credits: Number(user.get("credits") ?? 0) + credits,
				updatedAt: Timestamp.now(),
			});
			transaction.create(userRef.collection("creditLedger").doc(session.id), {
				type: "purchase",
				credits,
				stripeSessionId: session.id,
				createdAt: Timestamp.now(),
			});
		});
		return;
	}

	const tier = tierFromMetadata(session.metadata?.tier);

	if (tier) {
		await userRef.set(
			{
				tier,
				credits: TIER_MONTHLY_CREDITS[tier],
				reservedCredits: 0,
				stripeCustomerId:
					typeof session.customer === "string" ? session.customer : session.customer?.id,
				stripeSubscriptionId:
					typeof session.subscription === "string"
						? session.subscription
						: session.subscription?.id,
				subscriptionStatus: "active",
				monthlyCreditGrant: {
					credits: TIER_MONTHLY_CREDITS[tier],
					grantedAt: Timestamp.now(),
					tier,
				},
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
	}
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
	const userId = subscription.metadata.userId;
	const tier = tierFromMetadata(subscription.metadata.tier);

	if (!userId || !tier) {
		return;
	}

	await adminDb
		.collection("users")
		.doc(userId)
		.set(
			{
				tier: subscription.status === "active" ? tier : "free",
				subscriptionStatus: subscription.status,
				stripeSubscriptionId: subscription.id,
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
}

export async function POST(request: Request) {
	if (!env.STRIPE_WEBHOOK_SECRET) {
		return NextResponse.json({ error: "Stripe webhook not configured." }, { status: 500 });
	}

	const signature = (await headers()).get("stripe-signature");

	if (!signature) {
		return NextResponse.json({ error: "Stripe signature missing." }, { status: 400 });
	}

	const stripe = stripeClient();
	const body = await request.text();
	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
	} catch {
		return NextResponse.json({ error: "Stripe signature invalid." }, { status: 400 });
	}

	if (event.type === "checkout.session.completed") {
		await handleCheckoutComplete(event.data.object);
	}

	if (event.type === "customer.subscription.updated") {
		await handleSubscriptionChange(event.data.object);
	}

	if (event.type === "customer.subscription.deleted") {
		await handleSubscriptionChange(event.data.object);
	}

	return NextResponse.json({ received: true });
}
