import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { adminDb, Timestamp } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function POST() {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Authentication required." }, { status: 401 });
	}

	await adminDb.collection("users").doc(user.uid).set(
		{
			lastChangelogSeenAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
		},
		{ merge: true },
	);

	return NextResponse.json({ updated: true });
}
