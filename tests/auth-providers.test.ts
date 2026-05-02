import { describe, expect, it } from "vitest";
import {
	emailIdentifiersFromProviders,
	linkedAuthProviderKey,
	linkedAuthProvidersFromDocument,
	linkedAuthProvidersFromFirebase,
	normalizeAuthEmail,
} from "@/lib/auth/providers";

describe("linked auth provider policy", () => {
	it("normalizes emails for duplicate-account checks", () => {
		expect(normalizeAuthEmail("  Student@Example.edu ")).toBe("student@example.edu");
		expect(normalizeAuthEmail("not-an-email")).toBeNull();
	});

	it("builds stable linked providers from Firebase provider data", () => {
		const providers = linkedAuthProvidersFromFirebase({
			providerData: [
				{ providerId: "google.com", email: "Student@Example.edu", uid: "google-1" },
				{ providerId: "phone", phoneNumber: "+15555550100" },
				{ providerId: "password", email: "student@example.edu" },
			],
			email: "student@example.edu",
			phoneNumber: "+15555550100",
			signInProvider: "google.com",
		});

		expect(providers.map(linkedAuthProviderKey)).toEqual([
			"email:student@example.edu",
			"google:student@example.edu",
			"phone:+15555550100",
		]);
		expect(emailIdentifiersFromProviders(providers)).toEqual(["student@example.edu"]);
	});

	it("keeps Google-only accounts distinct from password accounts while tracking email ownership", () => {
		const providers = linkedAuthProvidersFromFirebase({
			providerData: [{ providerId: "google.com", email: "student@example.edu" }],
			email: "student@example.edu",
			phoneNumber: "+15555550100",
			signInProvider: "google.com",
		});

		expect(providers.map((provider) => provider.type)).toEqual(["google", "phone"]);
		expect(emailIdentifiersFromProviders(providers)).toEqual(["student@example.edu"]);
	});

	it("ignores malformed provider document values", () => {
		expect(
			linkedAuthProvidersFromDocument([
				{ type: "email", identifier: "student@example.edu", label: "Email/password" },
				{ type: "saml", identifier: "bad" },
				{ type: "phone", identifier: "" },
			]),
		).toEqual([{ type: "email", identifier: "student@example.edu", label: "Email/password" }]);
	});
});
