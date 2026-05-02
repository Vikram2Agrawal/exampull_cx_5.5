import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { adminDb, adminStorage, FieldValue, Timestamp } from "@/lib/firebase/admin";

type AdminAuditActor = {
	operatorId?: string;
	authMethod?: "agent_password" | "system";
};

export type AdminAuditInput = AdminAuditActor & {
	action: string;
	target: string;
	details: string;
};

export type AdminAuditHashInput = {
	action: string;
	target: string;
	details: string;
	operatorId: string;
	authMethod: string;
	previousHash: string | null;
	sequence: number;
	createdAtMillis: number;
};

export type AdminAuditRecord = {
	id: string;
	action: string;
	target: string;
	details: string;
	operatorId: string;
	authMethod: string;
	via: string;
	previousHash: string | null;
	hash: string;
	sequence: number;
	createdAt: Timestamp;
	createdAtMillis: number;
	immutable: true;
};

function chainStateRef() {
	return adminDb.collection("audit_state").doc("chain");
}

function replicationRef(entryId: string) {
	return adminDb.collection("audit_replication").doc(entryId);
}

export function auditEntryHash(input: AdminAuditHashInput) {
	return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function adminAuditArchivePath(
	record: Pick<AdminAuditRecord, "id" | "sequence" | "createdAtMillis">,
) {
	const day = new Date(record.createdAtMillis).toISOString().slice(0, 10);
	const sequence = record.sequence.toString().padStart(12, "0");

	return `${env.AUDIT_ARCHIVE_PREFIX}/${day}/${sequence}-${record.id}.json`;
}

export function adminAuditArchivePayload(record: AdminAuditRecord) {
	return {
		archiveVersion: 1,
		id: record.id,
		action: record.action,
		target: record.target,
		details: record.details,
		operatorId: record.operatorId,
		authMethod: record.authMethod,
		via: record.via,
		previousHash: record.previousHash,
		hash: record.hash,
		sequence: record.sequence,
		createdAtMillis: record.createdAtMillis,
		immutable: record.immutable,
	};
}

function actor(input: AdminAuditActor) {
	return {
		operatorId: input.operatorId ?? "agent",
		authMethod: input.authMethod ?? "agent_password",
	};
}

export async function appendAdminAuditInTransaction(
	transaction: FirebaseFirestore.Transaction,
	input: AdminAuditInput,
) {
	const stateRef = chainStateRef();
	const state = await transaction.get(stateRef);
	const previousHash =
		typeof state.get("lastHash") === "string" ? String(state.get("lastHash")) : null;
	const sequence = Number(state.get("sequence") ?? 0) + 1;
	const createdAt = Timestamp.now();
	const entryActor = actor(input);
	const hash = auditEntryHash({
		action: input.action,
		target: input.target,
		details: input.details,
		operatorId: entryActor.operatorId,
		authMethod: entryActor.authMethod,
		previousHash,
		sequence,
		createdAtMillis: createdAt.toMillis(),
	});
	const entryRef = adminDb.collection("audit_log").doc();
	const record: AdminAuditRecord = {
		id: entryRef.id,
		action: input.action,
		target: input.target,
		details: input.details,
		operatorId: entryActor.operatorId,
		authMethod: entryActor.authMethod,
		via: entryActor.authMethod,
		previousHash,
		hash,
		sequence,
		createdAt,
		createdAtMillis: createdAt.toMillis(),
		immutable: true,
	};

	transaction.create(entryRef, {
		action: record.action,
		target: record.target,
		details: record.details,
		operatorId: record.operatorId,
		authMethod: record.authMethod,
		via: record.via,
		previousHash: record.previousHash,
		hash: record.hash,
		sequence: record.sequence,
		createdAt: record.createdAt,
		immutable: record.immutable,
	});
	transaction.create(replicationRef(record.id), {
		entryId: record.id,
		hash: record.hash,
		sequence: record.sequence,
		status: "pending",
		storageBucket: env.AUDIT_ARCHIVE_BUCKET ?? env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? null,
		storagePath: adminAuditArchivePath(record),
		attempts: 0,
		createdAt: record.createdAt,
		updatedAt: record.createdAt,
	});
	transaction.set(
		stateRef,
		{
			lastEntryId: record.id,
			lastHash: record.hash,
			sequence: record.sequence,
			updatedAt: record.createdAt,
		},
		{ merge: true },
	);

	return record;
}

export async function appendAdminAudit(input: AdminAuditInput) {
	const record = await adminDb.runTransaction((transaction) =>
		appendAdminAuditInTransaction(transaction, input),
	);
	await replicateAdminAudit(record);

	return record;
}

export async function replicateAdminAudit(record: AdminAuditRecord) {
	const storagePath = adminAuditArchivePath(record);
	const bucket = env.AUDIT_ARCHIVE_BUCKET
		? adminStorage.bucket(env.AUDIT_ARCHIVE_BUCKET)
		: adminStorage.bucket();
	const now = Timestamp.now();

	try {
		await bucket
			.file(storagePath)
			.save(`${JSON.stringify(adminAuditArchivePayload(record))}\n`, {
				contentType: "application/json",
				resumable: false,
				metadata: {
					cacheControl: "no-store",
					metadata: {
						auditHash: record.hash,
						auditSequence: record.sequence.toString(),
					},
				},
				preconditionOpts: {
					ifGenerationMatch: 0,
				},
			});
		await replicationRef(record.id).set(
			{
				status: "complete",
				storageBucket:
					env.AUDIT_ARCHIVE_BUCKET ?? env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? null,
				storagePath,
				replicatedAt: now,
				updatedAt: now,
				attempts: FieldValue.increment(1),
				lastError: null,
			},
			{ merge: true },
		);
	} catch (error) {
		await replicationRef(record.id)
			.set(
				{
					status: "pending",
					storageBucket:
						env.AUDIT_ARCHIVE_BUCKET ?? env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? null,
					storagePath,
					updatedAt: now,
					attempts: FieldValue.increment(1),
					lastError:
						error instanceof Error ? error.message : "Audit archive write failed.",
				},
				{ merge: true },
			)
			.catch(() => undefined);
	}
}

export async function recordAdminAuditAccess(input: AdminAuditActor = {}) {
	const accessActor = actor(input);

	await adminDb.collection("audit_access").add({
		action: "audit_log_read",
		operatorId: accessActor.operatorId,
		authMethod: accessActor.authMethod,
		via: accessActor.authMethod,
		createdAt: Timestamp.now(),
	});
}
