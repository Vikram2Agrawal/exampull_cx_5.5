import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/session";
import {
	createFeaturebaseJwt,
	featurebaseJwtTtlSeconds,
	featurebasePortalUrl,
	hasUnreadChangelog,
	safeFeaturebaseReturnTo,
} from "@/lib/featurebase/sso";
import { defaultNotificationPreferences } from "@/lib/user/notification-preferences";

vi.mock("@/lib/env", () => ({
	env: {
		NEXT_PUBLIC_FEATUREBASE_ORGANIZATION: "exampull-test",
		FEATUREBASE_JWT_SECRET: "featurebase-secret",
		WEB_URL: "https://app.exampull.test",
	},
	publicBaseUrl: () => "https://app.exampull.test",
}));

const user: CurrentUser = {
	uid: "user_123",
	email: "student@example.edu",
	displayName: "ExamPull Student",
	phoneNumber: "+15555550123",
	tier: "guru",
	accountStatus: "clean",
	suspendedAt: null,
	suspensionReason: null,
	credits: 120,
	reservedCredits: 0,
	subscriptionStatus: "active",
	paymentFailureGraceUntil: null,
	notificationPreferences: defaultNotificationPreferences(),
	unreadNotificationCount: 0,
	isTestAccount: true,
	linkedAuthProviders: [],
	boostUsedAt: null,
	boostGradingUsedAt: null,
	theme: "system",
};

describe("Featurebase SSO", () => {
	it("signs the minimal profile fields with a one-hour TTL", async () => {
		const token = await createFeaturebaseJwt(user);
		expect(token).toBeTruthy();

		const [header, payload, signature] = (token ?? "").split(".");
		const expectedSignature = createHmac("sha256", "featurebase-secret")
			.update(`${header}.${payload}`)
			.digest("base64url");
		const decodedPayload = JSON.parse(
			Buffer.from(payload ?? "", "base64url").toString("utf8"),
		) as Record<string, unknown>;

		expect(signature).toBe(expectedSignature);
		expect(decodedPayload).toMatchObject({
			name: "ExamPull Student",
			email: "student@example.edu",
			userId: "user_123",
			plan: "guru",
			tier: "guru",
			isTestAccount: true,
			tags: ["Test Account"],
		});
		expect(Number(decodedPayload.exp) - Number(decodedPayload.iat)).toBe(
			featurebaseJwtTtlSeconds,
		);
	});

	it("builds chrome-hidden portal URLs and rejects cross-origin return targets", () => {
		const url = featurebasePortalUrl({ surface: "roadmap", jwt: "signed-token" });
		expect(url).toBe(
			"https://exampull-test.featurebase.app/roadmap?hideMenu=true&hideLogo=true&jwt=signed-token",
		);
		expect(safeFeaturebaseReturnTo("https://exampull-test.featurebase.app/changelog")).toBe(
			"https://exampull-test.featurebase.app/changelog",
		);
		expect(safeFeaturebaseReturnTo("https://evil.example/steal")).toBe(
			"https://exampull-test.featurebase.app/",
		);
	});

	it("treats missing or old changelog acknowledgements as unread", () => {
		expect(hasUnreadChangelog(null)).toBe(true);
		expect(hasUnreadChangelog("2026-05-01T00:00:00.000Z")).toBe(true);
		expect(hasUnreadChangelog("2026-05-03T00:00:00.000Z")).toBe(false);
	});
});
