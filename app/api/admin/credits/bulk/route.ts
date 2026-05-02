import { NextResponse } from "next/server";
import { z } from "zod";
import { executeBulkCreditGrant, previewBulkCreditGrant } from "@/lib/admin/credits";
import { requireAdminApiSession } from "@/lib/admin/request";

export const runtime = "nodejs";

const audienceSchema = z.object({
	tier: z.enum(["any", "free", "scholar", "guru"]).default("any"),
	testAccounts: z.enum(["exclude", "only", "include"]).default("exclude"),
	emailContains: z.string().trim().max(160).nullable().default(null),
	limit: z.number().int().min(1).max(500).default(100),
});

const requestSchema = z.object({
	mode: z.enum(["preview", "execute"]),
	audience: audienceSchema,
	amount: z.number().int().min(1).max(10000),
	reason: z.string().trim().min(4).max(500),
	expiresAt: z.string().trim().max(40).nullable().default(null),
	previewId: z.string().trim().max(160).optional(),
});

export async function POST(request: Request) {
	const input = requestSchema.parse(await request.json());
	const authError = await requireAdminApiSession(request, {
		requireCsrf: true,
		requireReauth: input.mode === "execute",
	});

	if (authError) {
		return authError;
	}

	try {
		if (input.mode === "preview") {
			const preview = await previewBulkCreditGrant(input);

			return NextResponse.json(preview);
		}

		if (!input.previewId) {
			return NextResponse.json({ error: "Dry-run preview required." }, { status: 400 });
		}

		const result = await executeBulkCreditGrant({
			...input,
			previewId: input.previewId,
		});

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Bulk credit grant failed.";

		return NextResponse.json({ error: message }, { status: 400 });
	}
}
