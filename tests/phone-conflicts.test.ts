import { describe, expect, it } from "vitest";
import {
	decidePhoneConflict,
	dormantPhoneClaimMs,
	latestAccountActivityMillis,
} from "@/lib/auth/phone-conflicts";

describe("phone conflict policy", () => {
	it("allows the same uid to continue using its verified phone", () => {
		expect(
			decidePhoneConflict({
				existingUid: "user_1",
				incomingUid: "user_1",
				lastActivityMs: Date.now(),
				nowMs: Date.now(),
			}),
		).toEqual({ kind: "same_user" });
	});

	it("requires prior auth source for active conflicting accounts", () => {
		const nowMs = Date.UTC(2026, 4, 1);
		const lastActivityMs = nowMs - 30 * 24 * 60 * 60 * 1000;

		expect(
			decidePhoneConflict({
				existingUid: "old",
				incomingUid: "new",
				lastActivityMs,
				nowMs,
			}),
		).toEqual({
			kind: "prior_auth_required",
			dormantEligibleAt: new Date(lastActivityMs + dormantPhoneClaimMs).toISOString(),
		});
	});

	it("allows dormant 180-day phone reclaim without inheriting account data", () => {
		const nowMs = Date.UTC(2026, 4, 1);
		const lastActivityMs = nowMs - dormantPhoneClaimMs - 1000;

		expect(
			decidePhoneConflict({
				existingUid: "old",
				incomingUid: "new",
				lastActivityMs,
				nowMs,
			}),
		).toEqual({
			kind: "dormant_reclaim",
			dormantSince: new Date(lastActivityMs).toISOString(),
		});
	});

	it("uses the newest known account activity timestamp", () => {
		expect(
			latestAccountActivityMillis([
				new Date("2026-01-01T00:00:00.000Z"),
				new Date("2026-02-01T00:00:00.000Z"),
			]),
		).toBe(Date.parse("2026-02-01T00:00:00.000Z"));
	});
});
