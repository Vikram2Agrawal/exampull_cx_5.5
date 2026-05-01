import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeClient } from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import { adminDb, Timestamp } from "@/lib/firebase/admin";
import { TIER_MONTHLY_CREDITS, type Tier } from "@/lib/product/constants";
import { applyReferralPaidReward } from "@/lib/referrals";
import { createUserNotification } from "@/lib/user/data";

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

		const granted = await adminDb.runTransaction(async (transaction) => {
			const user = await transaction.get(userRef);
			const ledgerRef = userRef.collection("creditLedger").doc(session.id);
			const ledger = await transaction.get(ledgerRef);

			if (ledger.exists) {
				return false;
			}

			transaction.update(userRef, {
				credits: Number(user.get("credits") ?? 0) + credits,
				updatedAt: Timestamp.now(),
			});
			transaction.create(ledgerRef, {
				type: "purchase",
				credits,
				stripeSessionId: session.id,
				createdAt: Timestamp.now(),
			});
			return true;
		});

		if (granted) {
			await createUserNotification({
				userId,
				title: "Credits added",
				body: `${credits} purchased credits are now available.`,
				kind: "billing",
				href: "/billing",
			});
		}
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
		await createUserNotification({
			userId,
			title: `${tier} is active`,
			body: `${TIER_MONTHLY_CREDITS[tier]} monthly credits are available.`,
			kind: "billing",
			href: "/billing",
		});
		await applyReferralPaidReward(userId, tier);
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
	await createUserNotification({
		userId,
		title: "Subscription updated",
		body:
			subscription.status === "active"
				? `${tier} access is active.`
				: "Your account has returned to the Free tier.",
		kind: "billing",
		href: "/billing",
	});
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
	if (invoice.billing_reason !== "subscription_cycle") {
		return;
	}

	const metadata = invoice.parent?.subscription_details?.metadata;
	const userId = metadata?.userId;
	const tier = tierFromMetadata(metadata?.tier);

	if (!userId || !tier) {
		return;
	}

	const userRef = adminDb.collection("users").doc(userId);
	const ledgerRef = userRef.collection("creditLedger").doc(`invoice_${invoice.id}`);
	const credits = TIER_MONTHLY_CREDITS[tier];
	const granted = await adminDb.runTransaction(async (transaction) => {
		const [userSnapshot, ledgerSnapshot] = await Promise.all([
			transaction.get(userRef),
			transaction.get(ledgerRef),
		]);

		if (ledgerSnapshot.exists) {
			return false;
		}

		transaction.update(userRef, {
			tier,
			credits: Number(userSnapshot.get("credits") ?? 0) + credits,
			subscriptionStatus: "active",
			updatedAt: Timestamp.now(),
		});
		transaction.create(ledgerRef, {
			type: "monthly_subscription_grant",
			credits,
			tier,
			stripeInvoiceId: invoice.id,
			createdAt: Timestamp.now(),
		});
		return true;
	});

	if (granted) {
		await createUserNotification({
			userId,
			title: "Monthly credits refreshed",
			body: `${credits} ${tier} credits have been added for this billing period.`,
			kind: "billing",
			href: "/billing",
		});
	}
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

	if (event.type === "invoice.paid") {
		await handleInvoicePaid(event.data.object);
	}

	return NextResponse.json({ received: true });
}
