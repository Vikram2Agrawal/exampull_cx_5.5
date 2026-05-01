import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Tier } from "@/lib/product/constants";

export const userSessionCookieName = "session";
export const userSessionMaxAgeSeconds = 60 * 60 * 24 * 5;

export type CurrentUser = {
	uid: string;
	email: string | null;
	displayName: string;
	phoneNumber: string;
	tier: Tier;
	credits: number;
	reservedCredits: number;
	isTestAccount: boolean;
};

export async function readUserSessionCookie() {
	const cookieStore = await cookies();
	return cookieStore.get(userSessionCookieName)?.value;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
	const token = await readUserSessionCookie();
	if (!token) {
		return null;
	}

	try {
		const decoded = await adminAuth.verifySessionCookie(token, true);
		const snapshot = await adminDb.collection("users").doc(decoded.uid).get();

		if (!snapshot.exists) {
			return null;
		}

		const data = snapshot.data() ?? {};

		return {
			uid: decoded.uid,
			email: typeof data.email === "string" ? data.email : (decoded.email ?? null),
			displayName:
				typeof data.displayName === "string" && data.displayName.trim()
					? data.displayName
					: "Student",
			phoneNumber:
				typeof data.phoneNumber === "string"
					? data.phoneNumber
					: (decoded.phone_number ?? ""),
			tier: data.tier === "scholar" || data.tier === "guru" ? data.tier : "free",
			credits: Number(data.credits ?? 0),
			reservedCredits: Number(data.reservedCredits ?? 0),
			isTestAccount: Boolean(data.isTestAccount ?? false),
		};
	} catch {
		return null;
	}
}
