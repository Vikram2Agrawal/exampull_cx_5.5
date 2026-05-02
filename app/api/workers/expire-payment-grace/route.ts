import { NextResponse } from "next/server";
import { z } from "zod";
import { processPaymentFailureGracePeriods } from "@/lib/billing/payment-failure-grace";
import { requireWorkerRequest } from "@/lib/tasks/auth";

export const runtime = "nodejs";

const requestSchema = z.object({
	limit: z.number().int().min(1).max(500).default(100),
});

export async function POST(request: Request) {
	const authError = await requireWorkerRequest(request);
	if (authError) {
		return authError;
	}

	const body = await request.json().catch(() => ({}));
	const input = requestSchema.parse(body);
	const result = await processPaymentFailureGracePeriods({ limit: input.limit });

	return NextResponse.json(result);
}
