import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
	createFeaturebaseJwt,
	featurebaseOrganization,
	featurebasePortalUrl,
	hasUnreadChangelog,
} from "@/lib/featurebase/sso";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET() {
	const user = await getCurrentUser();
	const organization = featurebaseOrganization();

	if (!user) {
		return NextResponse.json({ error: "Authentication required." }, { status: 401 });
	}

	const [jwt, profile] = await Promise.all([
		createFeaturebaseJwt(user),
		adminDb.collection("users").doc(user.uid).get(),
	]);

	return NextResponse.json({
		organization,
		featurebaseJwt: jwt,
		configured: Boolean(organization),
		hasUnreadChangelog: hasUnreadChangelog(profile.get("lastChangelogSeenAt")),
		urls: {
			feedback: featurebasePortalUrl({ surface: "feedback", jwt }),
			roadmap: featurebasePortalUrl({ surface: "roadmap", jwt }),
			changelog: featurebasePortalUrl({ surface: "changelog", jwt }),
		},
	});
}
