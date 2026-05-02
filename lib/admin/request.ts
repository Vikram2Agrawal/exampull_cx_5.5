import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
	verifyAdminCsrfToken,
	verifyAdminReauthPassword,
	verifyAdminSessionToken,
} from "@/lib/admin/session";

export async function requireAdminApiSession(
	request?: Request,
	options: { requireCsrf?: boolean; requireReauth?: boolean } = {},
) {
	const cookieStore = await cookies();
	const sessionCookie = cookieStore.get("admin_session")?.value;
	const session = await verifyAdminSessionToken(sessionCookie);

	if (!session) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	if (options.requireCsrf) {
		const validCsrf = await verifyAdminCsrfToken({
			sessionToken: sessionCookie ?? "",
			csrfToken: request?.headers.get("x-admin-csrf-token") ?? null,
		});

		if (!validCsrf) {
			return NextResponse.json({ error: "Invalid admin request." }, { status: 403 });
		}
	}

	if (options.requireReauth) {
		const validReauth = await verifyAdminReauthPassword({
			password: request?.headers.get("x-admin-reauth-password") ?? null,
		});

		if (!validReauth) {
			return NextResponse.json(
				{ error: "Admin re-authentication required." },
				{ status: 403 },
			);
		}
	}

	return null;
}
