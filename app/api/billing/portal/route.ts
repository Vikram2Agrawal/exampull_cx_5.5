import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { stripeClient } from "@/lib/billing/stripe";
import { publicBaseUrl } from "@/lib/env";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function POST() {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const snapshot = await adminDb.collection("users").doc(user.uid).get();
	const customerId = snapshot.get("stripeCustomerId") as string | undefined;

	if (!customerId) {
		return NextResponse.json({ error: "No Stripe customer exists yet." }, { status: 400 });
	}

	const session = await stripeClient().billingPortal.sessions.create({
		customer: customerId,
		return_url: `${publicBaseUrl()}/billing`,
	});

	return NextResponse.json({ url: session.url });
}
