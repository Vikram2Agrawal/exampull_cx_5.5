import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin/request";
import { searchAdmin } from "@/lib/admin/search";

export const runtime = "nodejs";

const querySchema = z.object({
	q: z.string().trim().max(120).default(""),
});

export async function GET(request: Request) {
	const authError = await requireAdminApiSession();

	if (authError) {
		return authError;
	}

	const url = new URL(request.url);
	const input = querySchema.parse({ q: url.searchParams.get("q") ?? "" });
	const results = await searchAdmin(input.q, 10);

	return NextResponse.json({ results });
}
