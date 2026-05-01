import { NextResponse } from "next/server";
import { z } from "zod";
import { updateTriageStatus } from "@/lib/admin/data";
import { requireAdminApiSession } from "@/lib/admin/request";

export const runtime = "nodejs";

const requestSchema = z.object({
	status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
	note: z.string().trim().max(500).optional(),
});

function collectionName(value: string) {
	if (value === "feedback" || value === "abuseReports") {
		return value;
	}

	throw new Error("Unsupported triage collection.");
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ collectionName: string; itemId: string }> },
) {
	const authError = await requireAdminApiSession();
	if (authError) {
		return authError;
	}

	const { collectionName: rawCollectionName, itemId } = await params;

	try {
		const input = requestSchema.parse(await request.json());
		const result = await updateTriageStatus({
			collectionName: collectionName(rawCollectionName),
			itemId,
			status: input.status,
			note: input.note,
		});

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Triage update failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
