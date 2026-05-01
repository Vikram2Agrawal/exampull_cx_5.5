export const dormantPhoneClaimDays = 180;
export const dormantPhoneClaimMs = dormantPhoneClaimDays * 24 * 60 * 60 * 1000;

export type PhoneConflictDecision =
	| { kind: "same_user" }
	| { kind: "dormant_reclaim"; dormantSince: string }
	| { kind: "prior_auth_required"; dormantEligibleAt: string | null };

export function timestampMillis(value: unknown) {
	if (value instanceof Date) {
		return value.getTime();
	}

	if (typeof value === "object" && value !== null) {
		if ("toMillis" in value && typeof value.toMillis === "function") {
			const millis = value.toMillis();
			return typeof millis === "number" ? millis : null;
		}

		if ("toDate" in value && typeof value.toDate === "function") {
			const date = value.toDate();
			return date instanceof Date ? date.getTime() : null;
		}
	}

	return null;
}

export function latestAccountActivityMillis(values: unknown[]) {
	const millis = values
		.map(timestampMillis)
		.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

	if (millis.length === 0) {
		return null;
	}

	return Math.max(...millis);
}

export function decidePhoneConflict({
	existingUid,
	incomingUid,
	lastActivityMs,
	nowMs,
}: {
	existingUid: string;
	incomingUid: string;
	lastActivityMs: number | null;
	nowMs: number;
}): PhoneConflictDecision {
	if (existingUid === incomingUid) {
		return { kind: "same_user" };
	}

	if (lastActivityMs !== null && nowMs - lastActivityMs >= dormantPhoneClaimMs) {
		return {
			kind: "dormant_reclaim",
			dormantSince: new Date(lastActivityMs).toISOString(),
		};
	}

	return {
		kind: "prior_auth_required",
		dormantEligibleAt:
			lastActivityMs === null
				? null
				: new Date(lastActivityMs + dormantPhoneClaimMs).toISOString(),
	};
}
