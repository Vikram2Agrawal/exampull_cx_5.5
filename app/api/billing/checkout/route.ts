import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { checkoutCatalog, checkoutUrls, stripeClient } from "@/lib/billing/stripe";
import { adminDb, Timestamp } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
	sku: z.enum([
		"scholar_monthly",
		"scholar_annual",
		"guru_monthly",
		"guru_annual",
		"credits_20",
		"credits_100",
		"credits_240",
	]),
});

export async function POST(request: Request) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const input = requestSchema.parse(await request.json());
	const catalogItem = checkoutCatalog[input.sku];

	if (!catalogItem.priceId) {
		return NextResponse.json({ error: "Price is not configured." }, { status: 500 });
	}

	const stripe = stripeClient();
	const userRef = adminDb.collection("users").doc(user.uid);
	const snapshot = await userRef.get();
	let customerId = snapshot.get("stripeCustomerId") as string | undefined;

	if (!customerId) {
		const customer = await stripe.customers.create({
			email: user.email ?? undefined,
			name: user.displayName,
			phone: user.phoneNumber,
			metadata: { userId: user.uid },
		});
		customerId = customer.id;
		await userRef.set(
			{ stripeCustomerId: customerId, updatedAt: Timestamp.now() },
			{ merge: true },
		);
	}

	const session = await stripe.checkout.sessions.create({
		customer: customerId,
		mode: catalogItem.mode,
		line_items: [{ price: catalogItem.priceId, quantity: 1 }],
		allow_promotion_codes: true,
		metadata: { ...catalogItem.metadata, userId: user.uid, sku: input.sku },
		subscription_data:
			catalogItem.mode === "subscription"
				? { metadata: { ...catalogItem.metadata, userId: user.uid, sku: input.sku } }
				: undefined,
		...checkoutUrls(),
	});

	return NextResponse.json({ url: session.url });
}
