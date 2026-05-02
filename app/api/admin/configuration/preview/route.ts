import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAdminAudit } from "@/lib/admin/data";
import { requireAdminApiSession } from "@/lib/admin/request";
import { setPreviewGenerationDisabled } from "@/lib/config/runtime";

export const runtime = "nodejs";

const requestSchema = z.object({
	disabled: z.boolean(),
	message: z.string().trim().max(240).optional(),
	reason: z.string().trim().min(4).max(500),
});

export async function PATCH(request: Request) {
	const authError = await requireAdminApiSession(request, {
		requireCsrf: true,
		requireReauth: true,
	});
	if (authError) {
		return authError;
	}

	try {
		const input = requestSchema.parse(await request.json());
		const config = await setPreviewGenerationDisabled({
			disabled: input.disabled,
			message: input.message,
		});
		await writeAdminAudit({
			action: input.disabled ? "preview_kill_switch_enabled" : "preview_kill_switch_disabled",
			target: "config/runtime",
			details: input.reason,
		});

		return NextResponse.json(config);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Preview configuration failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
