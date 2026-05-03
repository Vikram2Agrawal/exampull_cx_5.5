import { ChangelogSeenMarker } from "@/components/feedback/changelog-seen-marker";
import { FeaturebaseEmbed } from "@/components/feedback/featurebase-embed";
import { PublicNav } from "@/components/layout/site-nav";
import { SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { createFeaturebaseJwt, featurebasePortalUrl } from "@/lib/featurebase/sso";

export default async function ChangelogPage() {
	const user = await getCurrentUser();
	const jwt = user ? await createFeaturebaseJwt(user) : null;

	return (
		<div className="min-h-screen">
			{user ? <ChangelogSeenMarker /> : null}
			<PublicNav />
			<main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
				<SectionHeader title="Changelog">
					<p>
						Product changes, generated from the same customer-voice system as the
						roadmap.
					</p>
				</SectionHeader>
				<div className="mt-10">
					<FeaturebaseEmbed
						src={featurebasePortalUrl({ surface: "changelog", jwt })}
						title="Changelog"
						fallbackTitle="Changelog"
					/>
				</div>
			</main>
		</div>
	);
}
