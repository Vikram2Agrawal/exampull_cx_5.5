import { cookies } from "next/headers";
import { type LinkedAuthProvider, linkedAuthProvidersFromDocument } from "@/lib/auth/providers";
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
	subscriptionStatus: string | null;
	paymentFailureGraceUntil: string | null;
	unreadNotificationCount: number;
	isTestAccount: boolean;
	linkedAuthProviders: LinkedAuthProvider[];
	boostUsedAt: string | null;
	boostGradingUsedAt: string | null;
	theme: "system" | "light" | "dark";
};

export async function readUserSessionCookie() {
	const cookieStore = await cookies();
	return cookieStore.get(userSessionCookieName)?.value;
}

function optionalTimestampIso(value: unknown) {
	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === "object" && value !== null && "toDate" in value) {
		const maybeDate = value.toDate;
		if (typeof maybeDate === "function") {
			const date = maybeDate.call(value);
			return date instanceof Date ? date.toISOString() : null;
		}
	}

	return null;
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
			subscriptionStatus:
				typeof data.subscriptionStatus === "string" ? data.subscriptionStatus : null,
			paymentFailureGraceUntil: optionalTimestampIso(data.paymentFailureGraceUntil),
			unreadNotificationCount: Number(data.unreadNotificationCount ?? 0),
			isTestAccount: Boolean(data.isTestAccount ?? false),
			linkedAuthProviders: linkedAuthProvidersFromDocument(data.linkedAuthProviders),
			boostUsedAt: optionalTimestampIso(data.boostUsedAt),
			boostGradingUsedAt: optionalTimestampIso(data.boostGradingUsedAt),
			theme:
				data.settings &&
				typeof data.settings === "object" &&
				data.settings.theme === "light"
					? "light"
					: data.settings &&
							typeof data.settings === "object" &&
							data.settings.theme === "dark"
						? "dark"
						: "system",
		};
	} catch {
		return null;
	}
}
