import { randomUUID } from "node:crypto";
import { appendAdminAudit } from "@/lib/admin/audit";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";

export type BulkCreditAudience = {
	tier: "any" | "free" | "scholar" | "guru";
	testAccounts: "exclude" | "only" | "include";
	emailContains: string | null;
	limit: number;
};

export type BulkCreditPreview = {
	previewId: string;
	recipientCount: number;
	totalCredits: number;
	sample: Array<{ userId: string; email: string; tier: string; credits: number }>;
	expiresAt: string;
};

export type BulkCreditGrantRow = {
	id: string;
	status: string;
	amount: number;
	recipientCount: number;
	totalCredits: number;
	reason: string;
	audienceLabel: string;
	rollbackExpiresAt: string;
	createdAt: string;
};

type BulkCreditRecipient = {
	userId: string;
	email: string;
	tier: string;
	credits: number;
	isTestAccount: boolean;
};

const previewTtlMs = 15 * 60 * 1000;
const rollbackWindowMs = 24 * 60 * 60 * 1000;

function isoDate(value: unknown) {
	if (value instanceof Timestamp) {
		return value.toDate().toISOString();
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	return new Date().toISOString();
}

function text(value: unknown, fallback = "") {
	return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeAudience(input: BulkCreditAudience): BulkCreditAudience {
	return {
		tier: input.tier,
		testAccounts: input.testAccounts,
		emailContains: input.emailContains?.trim().toLowerCase() || null,
		limit: Math.min(Math.max(input.limit, 1), 500),
	};
}

function audienceLabel(audience: BulkCreditAudience) {
	const parts = [
		audience.tier === "any" ? "any tier" : audience.tier,
		audience.testAccounts === "include"
			? "including test accounts"
			: audience.testAccounts === "only"
				? "test accounts only"
				: "organic accounts only",
		audience.emailContains ? `email contains ${audience.emailContains}` : null,
		`limit ${audience.limit.toString()}`,
	].filter((part): part is string => Boolean(part));

	return parts.join(" · ");
}

async function matchingBulkCreditRecipients(audienceInput: BulkCreditAudience) {
	const audience = normalizeAudience(audienceInput);
	let query: FirebaseFirestore.Query = adminDb.collection("users");

	if (audience.tier !== "any") {
		query = query.where("tier", "==", audience.tier);
	}

	if (audience.testAccounts !== "include") {
		query = query.where("isTestAccount", "==", audience.testAccounts === "only");
	}

	const scanLimit = audience.emailContains ? 1000 : Math.min(audience.limit * 3, 1000);
	const snapshot = await query.limit(scanLimit).get();
	const recipients = snapshot.docs
		.map((doc) => ({
			userId: doc.id,
			email: text(doc.get("email"), doc.id),
			tier: text(doc.get("tier"), "free"),
			credits: Number(doc.get("credits") ?? 0),
			isTestAccount: doc.get("isTestAccount") === true,
		}))
		.filter((recipient) =>
			audience.emailContains
				? recipient.email.toLowerCase().includes(audience.emailContains)
				: true,
		)
		.slice(0, audience.limit);

	return { audience, recipients };
}

export async function previewBulkCreditGrant({
	audience,
	amount,
	reason,
	expiresAt,
}: {
	audience: BulkCreditAudience;
	amount: number;
	reason: string;
	expiresAt: string | null;
}): Promise<BulkCreditPreview> {
	const { audience: normalizedAudience, recipients } =
		await matchingBulkCreditRecipients(audience);
	const previewId = randomUUID();
	const expires = Timestamp.fromMillis(Date.now() + previewTtlMs);

	await adminDb
		.collection("bulk_credit_grant_previews")
		.doc(previewId)
		.set({
			audience: normalizedAudience,
			amount,
			reason,
			grantExpiresAt: expiresAt,
			recipientIds: recipients.map((recipient) => recipient.userId),
			sample: recipients.slice(0, 10),
			recipientCount: recipients.length,
			totalCredits: recipients.length * amount,
			expiresAt: expires,
			createdAt: Timestamp.now(),
		});

	return {
		previewId,
		recipientCount: recipients.length,
		totalCredits: recipients.length * amount,
		sample: recipients.slice(0, 10).map(({ userId, email, tier, credits }) => ({
			userId,
			email,
			tier,
			credits,
		})),
		expiresAt: expires.toDate().toISOString(),
	};
}

async function commitBulkCreditGrant({
	grantId,
	recipients,
	amount,
	reason,
	grantExpiresAt,
}: {
	grantId: string;
	recipients: BulkCreditRecipient[];
	amount: number;
	reason: string;
	grantExpiresAt: string | null;
}) {
	for (let index = 0; index < recipients.length; index += 150) {
		const batch = adminDb.batch();
		const chunk = recipients.slice(index, index + 150);
		const now = Timestamp.now();

		for (const recipient of chunk) {
			const userRef = adminDb.collection("users").doc(recipient.userId);
			const notificationRef = userRef.collection("notifications").doc();

			batch.set(
				userRef,
				{
					credits: FieldValue.increment(amount),
					manualCreditGrantCount: FieldValue.increment(1),
					unreadNotificationCount: FieldValue.increment(1),
					updatedAt: now,
				},
				{ merge: true },
			);
			batch.set(userRef.collection("creditLedger").doc(`${grantId}_${recipient.userId}`), {
				type: "bulk_admin_grant",
				credits: amount,
				bulkGrantId: grantId,
				reason,
				expiresAt: grantExpiresAt,
				createdAt: now,
			});
			batch.set(notificationRef, {
				title: "Credits granted",
				body: `${amount.toString()} credits were added to your ExamPull account.`,
				kind: "billing",
				href: "/billing",
				read: false,
				isTestData: recipient.isTestAccount,
				createdAt: now,
				updatedAt: now,
			});
		}

		await batch.commit();
	}
}

export async function executeBulkCreditGrant({
	previewId,
	audience,
	amount,
	reason,
	expiresAt,
}: {
	previewId: string;
	audience: BulkCreditAudience;
	amount: number;
	reason: string;
	expiresAt: string | null;
}) {
	const previewRef = adminDb.collection("bulk_credit_grant_previews").doc(previewId);
	const previewSnapshot = await previewRef.get();

	if (!previewSnapshot.exists) {
		throw new Error("Bulk grant preview not found.");
	}

	const previewExpiresAt = previewSnapshot.get("expiresAt");
	if (previewExpiresAt instanceof Timestamp && previewExpiresAt.toMillis() < Date.now()) {
		throw new Error("Bulk grant preview expired.");
	}

	const normalizedAudience = normalizeAudience(audience);
	const previewAudience = previewSnapshot.get("audience") as BulkCreditAudience | undefined;
	const previewAudienceJson = JSON.stringify(previewAudience ?? {});
	const currentAudienceJson = JSON.stringify(normalizedAudience);

	if (
		previewAudienceJson !== currentAudienceJson ||
		Number(previewSnapshot.get("amount") ?? 0) !== amount ||
		text(previewSnapshot.get("reason")) !== reason ||
		(previewSnapshot.get("grantExpiresAt") ?? null) !== expiresAt
	) {
		throw new Error("Bulk grant parameters no longer match the dry run.");
	}

	const { recipients } = await matchingBulkCreditRecipients(normalizedAudience);
	const previewRecipientIds = Array.isArray(previewSnapshot.get("recipientIds"))
		? previewSnapshot.get("recipientIds").filter((id: unknown) => typeof id === "string")
		: [];
	const currentRecipientIds = recipients.map((recipient) => recipient.userId);

	if (JSON.stringify(previewRecipientIds) !== JSON.stringify(currentRecipientIds)) {
		throw new Error("Bulk grant audience changed since the dry run.");
	}

	const grantId = randomUUID();
	const now = Timestamp.now();
	const rollbackExpiresAt = Timestamp.fromMillis(Date.now() + rollbackWindowMs);

	await adminDb
		.collection("bulk_credit_grants")
		.doc(grantId)
		.create({
			status: "applied",
			amount,
			reason,
			audience: normalizedAudience,
			audienceLabel: audienceLabel(normalizedAudience),
			recipientIds: currentRecipientIds,
			recipientCount: recipients.length,
			totalCredits: recipients.length * amount,
			expiresAt,
			rollbackExpiresAt,
			createdAt: now,
			updatedAt: now,
		});
	await commitBulkCreditGrant({
		grantId,
		recipients,
		amount,
		reason,
		grantExpiresAt: expiresAt,
	});
	await previewRef.set({ executedAt: Timestamp.now(), grantId }, { merge: true });
	await appendAdminAudit({
		action: "bulk_grant_credits",
		target: `bulk_credit_grants/${grantId}`,
		details: `${amount.toString()} credits to ${recipients.length.toString()} users: ${reason}`,
	});

	return {
		grantId,
		recipientCount: recipients.length,
		totalCredits: recipients.length * amount,
		rollbackExpiresAt: rollbackExpiresAt.toDate().toISOString(),
	};
}

export async function listBulkCreditGrants(limit = 50): Promise<BulkCreditGrantRow[]> {
	const snapshot = await adminDb
		.collection("bulk_credit_grants")
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		status: text(doc.get("status"), "applied"),
		amount: Number(doc.get("amount") ?? 0),
		recipientCount: Number(doc.get("recipientCount") ?? 0),
		totalCredits: Number(doc.get("totalCredits") ?? 0),
		reason: text(doc.get("reason"), ""),
		audienceLabel: text(doc.get("audienceLabel"), "unknown audience"),
		rollbackExpiresAt: isoDate(doc.get("rollbackExpiresAt")),
		createdAt: isoDate(doc.get("createdAt")),
	}));
}
