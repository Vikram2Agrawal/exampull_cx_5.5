import { createHash } from "node:crypto";
import { adminDb, Timestamp } from "@/lib/firebase/admin";

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

function chainStateRef() {
	return adminDb.collection("audit_state").doc("chain");
}

export function auditEntryHash(input: AdminAuditHashInput) {
	return createHash("sha256").update(JSON.stringify(input)).digest("hex");
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

	transaction.create(entryRef, {
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
		immutable: true,
	});
	transaction.set(
		stateRef,
		{
			lastEntryId: entryRef.id,
			lastHash: hash,
			sequence,
			updatedAt: createdAt,
		},
		{ merge: true },
	);
}

export async function appendAdminAudit(input: AdminAuditInput) {
	await adminDb.runTransaction((transaction) =>
		appendAdminAuditInTransaction(transaction, input),
	);
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
