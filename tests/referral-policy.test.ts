import { describe, expect, it } from "vitest";
import { referralSuspicionReasons } from "@/lib/referrals/policy";

describe("referral fraud policy", () => {
	it("flags plus-address aliases between referrer and referred account", () => {
		expect(
			referralSuspicionReasons({
				referrerEmail: "student+owner@example.edu",
				referredEmail: "student+friend@example.edu",
				referrerPhoneNumber: "+15551234567",
				referredPhoneNumber: "+15557654321",
				recentReferralCount: 0,
			}),
		).toEqual(["same_email_alias"]);
	});

	it("flags matching phone numbers and rapid signup bursts", () => {
		expect(
			referralSuspicionReasons({
				referrerEmail: "owner@example.edu",
				referredEmail: "friend@example.edu",
				referrerPhoneNumber: "(555) 123-4567",
				referredPhoneNumber: "+1 555 123 4567",
				recentReferralCount: 5,
			}),
		).toEqual(["same_phone_number", "rapid_referral_velocity"]);
	});
});
