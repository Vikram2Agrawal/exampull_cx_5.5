import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin/request";
import { overrideReferralReward } from "@/lib/referrals";

export const runtime = "nodejs";

const requestSchema = z.object({
	action: z.enum([
		"mark_reviewed",
		"flag",
		"grant_scholar",
		"grant_guru",
		"revoke_scholar",
		"revoke_guru",
	]),
	reason: z.string().trim().min(4).max(500),
});

function requiresReauth(action: z.infer<typeof requestSchema>["action"]) {
	return action.startsWith("grant_") || action.startsWith("revoke_");
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ referralId: string }> },
) {
	const authError = await requireAdminApiSession(request, { requireCsrf: true });
	if (authError) {
		return authError;
	}

	const { referralId } = await params;

	try {
		const input = requestSchema.parse(await request.json());
		if (requiresReauth(input.action)) {
			const reauthError = await requireAdminApiSession(request, { requireReauth: true });
			if (reauthError) {
				return reauthError;
			}
		}

		const result = await overrideReferralReward({
			referralId,
			action: input.action,
			reason: input.reason,
		});

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Referral override failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
