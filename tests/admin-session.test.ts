import { describe, expect, it } from "vitest";
import { verifyAdminReauthPassword } from "@/lib/admin/session";

describe("admin re-authentication", () => {
	it("accepts only the configured admin password for destructive operations", async () => {
		await expect(
			verifyAdminReauthPassword({
				password: "correct-password",
				expectedPassword: "correct-password",
				secret: "session-secret",
			}),
		).resolves.toBe(true);
		await expect(
			verifyAdminReauthPassword({
				password: "wrong-password",
				expectedPassword: "correct-password",
				secret: "session-secret",
			}),
		).resolves.toBe(false);
		await expect(
			verifyAdminReauthPassword({
				password: null,
				expectedPassword: "correct-password",
				secret: "session-secret",
			}),
		).resolves.toBe(false);
	});
});
