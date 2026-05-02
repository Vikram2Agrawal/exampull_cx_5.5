import { NextResponse } from "next/server";
import { z } from "zod";
import { sendAdminCommunication } from "@/lib/admin/communications";
import { requireAdminApiSession } from "@/lib/admin/request";

export const runtime = "nodejs";

const channelSchema = z.enum(["email", "sms", "in_app"]);

const requestSchema = z.object({
	mode: z.enum(["single", "test", "broadcast"]),
	userId: z.string().trim().min(1).max(160).optional(),
	testEmail: z.string().trim().email().optional(),
	testPhoneNumber: z.string().trim().min(7).max(32).optional(),
	channels: z.array(channelSchema).min(1).max(3),
	subject: z.string().trim().min(3).max(160),
	body: z.string().trim().min(10).max(4000),
	audience: z
		.object({
			tier: z.enum(["any", "free", "scholar", "guru"]).default("any"),
			testAccounts: z.enum(["only", "exclude", "include"]).default("only"),
			limit: z.number().int().min(1).max(500).default(100),
		})
		.default({
			tier: "any",
			testAccounts: "only",
			limit: 100,
		}),
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
		const input = requestSchema.parse(await request.json());
		const result = await sendAdminCommunication(input);

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Communication send failed.";

		return NextResponse.json({ error: message }, { status: 400 });
	}
}
