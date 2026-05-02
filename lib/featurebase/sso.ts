import { createHmac } from "node:crypto";
import type { CurrentUser } from "@/lib/auth/session";
import { env, publicBaseUrl } from "@/lib/env";

export const featurebaseJwtTtlSeconds = 60 * 60;
export const latestChangelogPublishedAt = "2026-05-02T00:00:00.000Z";

export type FeaturebaseSurface = "feedback" | "roadmap" | "changelog";

export function featurebaseOrganization() {
	const organization = env.NEXT_PUBLIC_FEATUREBASE_ORGANIZATION?.trim().toLowerCase();

	if (!organization) {
		return null;
	}

	return organization.replace(/[^a-z0-9-]/g, "");
}

export function featurebasePortalBaseUrl(organization = featurebaseOrganization()) {
	return organization ? `https://${organization}.featurebase.app` : null;
}

export function featurebaseSurfacePath(surface: FeaturebaseSurface) {
	if (surface === "roadmap") {
		return "/roadmap";
	}

	if (surface === "changelog") {
		return "/changelog";
	}

	return "/";
}

export function featurebasePortalUrl({
	surface,
	jwt,
	hideChrome = true,
}: {
	surface: FeaturebaseSurface;
	jwt?: string | null;
	hideChrome?: boolean;
}) {
	const baseUrl = featurebasePortalBaseUrl();

	if (!baseUrl) {
		return null;
	}

	const url = new URL(featurebaseSurfacePath(surface), baseUrl);
	if (hideChrome) {
		url.searchParams.set("hideMenu", "true");
		url.searchParams.set("hideLogo", "true");
	}

	if (jwt) {
		url.searchParams.set("jwt", jwt);
	}

	return url.toString();
}

export function safeFeaturebaseReturnTo(value: string | null) {
	const baseUrl = featurebasePortalBaseUrl();

	if (!baseUrl || !value) {
		return featurebasePortalUrl({ surface: "feedback", hideChrome: false });
	}

	try {
		const parsed = new URL(value);
		const allowed = new URL(baseUrl);

		if (parsed.origin !== allowed.origin) {
			return featurebasePortalUrl({ surface: "feedback", hideChrome: false });
		}

		return parsed.toString();
	} catch {
		return featurebasePortalUrl({ surface: "feedback", hideChrome: false });
	}
}

export async function createFeaturebaseJwt(user: CurrentUser) {
	if (!env.FEATUREBASE_JWT_SECRET) {
		return null;
	}

	const nowSeconds = Math.floor(Date.now() / 1000);
	const header = {
		alg: "HS256",
		typ: "JWT",
	};
	const payload = {
		name: user.displayName,
		email: user.email,
		userId: user.uid,
		plan: user.tier,
		tier: user.tier,
		isTestAccount: user.isTestAccount,
		tags: user.isTestAccount ? ["Test Account"] : [],
		locale: "en",
		companies: [
			{
				id: "exampull",
				name: "ExamPull",
				createdAt: "2026-03-08T00:00:00.000Z",
				plan: user.tier,
			},
		],
		iat: nowSeconds,
		exp: nowSeconds + featurebaseJwtTtlSeconds,
	};
	const encodedHeader = base64UrlJson(header);
	const encodedPayload = base64UrlJson(payload);
	const unsigned = `${encodedHeader}.${encodedPayload}`;
	const signature = createHmac("sha256", env.FEATUREBASE_JWT_SECRET)
		.update(unsigned)
		.digest("base64url");

	return `${unsigned}.${signature}`;
}

function base64UrlJson(value: Record<string, unknown>) {
	return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function featurebaseSsoLoginUrl({
	jwt,
	returnTo,
}: {
	jwt: string;
	returnTo: string | null;
}) {
	const baseUrl = featurebasePortalBaseUrl();

	if (!baseUrl) {
		return publicBaseUrl();
	}

	const url = new URL("/api/v1/auth/access/jwt", baseUrl);
	url.searchParams.set("jwt", jwt);
	const safeReturnTo = safeFeaturebaseReturnTo(returnTo);
	if (safeReturnTo) {
		url.searchParams.set("return_to", safeReturnTo);
	}

	return url.toString();
}

export function hasUnreadChangelog(lastSeenAt: unknown) {
	if (typeof lastSeenAt === "object" && lastSeenAt !== null && "toDate" in lastSeenAt) {
		const maybeToDate = lastSeenAt.toDate;
		if (typeof maybeToDate === "function") {
			const date = maybeToDate.call(lastSeenAt);
			return date instanceof Date && date.getTime() < Date.parse(latestChangelogPublishedAt);
		}
	}

	if (lastSeenAt instanceof Date) {
		return lastSeenAt.getTime() < Date.parse(latestChangelogPublishedAt);
	}

	if (typeof lastSeenAt === "string") {
		const timestamp = Date.parse(lastSeenAt);
		return Number.isFinite(timestamp) && timestamp < Date.parse(latestChangelogPublishedAt);
	}

	return true;
}
