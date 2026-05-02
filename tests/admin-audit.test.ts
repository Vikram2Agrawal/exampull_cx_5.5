import { describe, expect, it } from "vitest";
import { auditEntryHash } from "@/lib/admin/audit";

const baseEntry = {
	action: "grant_credits",
	target: "users/example",
	details: "20 credits: support adjustment",
	operatorId: "agent",
	authMethod: "agent_password",
	previousHash: null,
	sequence: 1,
	createdAtMillis: 1_770_000_000_000,
} as const;

describe("admin audit hash chain", () => {
	it("produces a stable hash for identical audit entries", () => {
		expect(auditEntryHash(baseEntry)).toBe(auditEntryHash(baseEntry));
	});

	it("changes when the prior chain hash or entry content changes", () => {
		const original = auditEntryHash(baseEntry);

		expect(
			auditEntryHash({
				...baseEntry,
				previousHash: "previous",
				sequence: 2,
			}),
		).not.toBe(original);
		expect(
			auditEntryHash({
				...baseEntry,
				details: "21 credits: support adjustment",
			}),
		).not.toBe(original);
	});
});
