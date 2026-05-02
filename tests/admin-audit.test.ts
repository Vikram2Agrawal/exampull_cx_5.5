import { describe, expect, it } from "vitest";
import { adminAuditArchivePath, adminAuditArchivePayload, auditEntryHash } from "@/lib/admin/audit";
import { Timestamp } from "@/lib/firebase/admin";

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

	it("builds deterministic archive payloads and append-only object paths", () => {
		const createdAt = Timestamp.fromMillis(baseEntry.createdAtMillis);
		const record = {
			id: "entry_123",
			action: baseEntry.action,
			target: baseEntry.target,
			details: baseEntry.details,
			operatorId: baseEntry.operatorId,
			authMethod: baseEntry.authMethod,
			via: baseEntry.authMethod,
			previousHash: baseEntry.previousHash,
			hash: auditEntryHash(baseEntry),
			sequence: baseEntry.sequence,
			createdAt,
			createdAtMillis: createdAt.toMillis(),
			immutable: true,
		} as const;

		expect(adminAuditArchivePath(record)).toBe(
			"admin-audit-archive/v1/2026-02-02/000000000001-entry_123.json",
		);
		expect(adminAuditArchivePayload(record)).toMatchObject({
			archiveVersion: 1,
			id: "entry_123",
			hash: record.hash,
			sequence: 1,
			immutable: true,
		});
	});
});
