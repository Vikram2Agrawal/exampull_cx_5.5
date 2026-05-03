import { describe, expect, it } from "vitest";
import { normalizePhoneNumberInput, phonePreview } from "@/lib/auth/phone-format";

describe("phone number formatting", () => {
	it("normalizes common US entry formats to E.164", () => {
		expect(normalizePhoneNumberInput("6505550123")).toEqual({
			ok: true,
			value: "+16505550123",
		});
		expect(normalizePhoneNumberInput("(650) 555-0123")).toEqual({
			ok: true,
			value: "+16505550123",
		});
		expect(normalizePhoneNumberInput("1 650 555 0123")).toEqual({
			ok: true,
			value: "+16505550123",
		});
	});

	it("keeps explicit international country codes", () => {
		expect(normalizePhoneNumberInput("+44 20 7946 0958")).toEqual({
			ok: true,
			value: "+442079460958",
		});
	});

	it("explains incomplete or ambiguous entries", () => {
		const result = normalizePhoneNumberInput("555-0123");
		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error("Expected invalid phone number.");
		}
		expect(result.message).toContain("10-digit US number");
		expect(phonePreview("555-0123")).toBeNull();
	});
});
