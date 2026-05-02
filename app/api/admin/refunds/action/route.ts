import { NextResponse } from "next/server";
import { z } from "zod";
import { processAdminRefundAction } from "@/lib/admin/refunds";
import { requireAdminApiSession } from "@/lib/admin/request";

export const runtime = "nodejs";

const actionSchema = z.object({
	sourceCollection: z.enum(["feedback", "abuseReports"]),
	sourceId: z.string().trim().min(1).max(180),
	action: z.enum(["approve", "decline", "escalate", "submit_evidence"]),
	creditAmount: z.number().int().min(0).max(10000).default(0),
	cashAmountCents: z.number().int().min(0).max(100000).default(0),
	stripeChargeId: z.string().trim().max(120).nullable().default(null),
	note: z.string().trim().min(4).max(1200),
	disputeEvidence: z.string().trim().max(4000).nullable().default(null),
});

export async function POST(request: Request) {
	const authError = await requireAdminApiSession(request, {
		requireCsrf: true,
		requireReauth: true,
	});

	if (authError) {
		return authError;
	}

	try {
		const input = actionSchema.parse(await request.json());
		const result = await processAdminRefundAction(input);

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Refund action failed.";

		return NextResponse.json({ error: message }, { status: 400 });
	}
}
