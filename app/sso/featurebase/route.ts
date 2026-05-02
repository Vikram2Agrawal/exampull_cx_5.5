import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
	createFeaturebaseJwt,
	featurebaseSsoLoginUrl,
	safeFeaturebaseReturnTo,
} from "@/lib/featurebase/sso";

export const runtime = "nodejs";

export async function GET(request: Request) {
	const requestUrl = new URL(request.url);
	const returnTo = safeFeaturebaseReturnTo(requestUrl.searchParams.get("return_to"));
	const user = await getCurrentUser();

	if (!user) {
		const signInUrl = new URL("/sign-in", requestUrl.origin);
		signInUrl.searchParams.set(
			"returnTo",
			`/sso/featurebase?return_to=${encodeURIComponent(returnTo ?? "")}`,
		);

		return NextResponse.redirect(signInUrl);
	}

	const jwt = await createFeaturebaseJwt(user);

	if (!jwt) {
		return NextResponse.redirect(returnTo ?? new URL("/", requestUrl.origin).toString());
	}

	return NextResponse.redirect(featurebaseSsoLoginUrl({ jwt, returnTo }));
}
