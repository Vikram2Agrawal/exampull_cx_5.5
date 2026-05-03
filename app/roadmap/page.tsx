import { FeaturebaseEmbed } from "@/components/feedback/featurebase-embed";
import { PublicNav } from "@/components/layout/site-nav";
import { SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { createFeaturebaseJwt, featurebasePortalUrl } from "@/lib/featurebase/sso";

export default async function RoadmapPage() {
	const user = await getCurrentUser();
	const jwt = user ? await createFeaturebaseJwt(user) : null;

	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
				<SectionHeader title="Roadmap">
					<p>Public product direction. Voting and comments require an account.</p>
				</SectionHeader>
				<div className="mt-10">
					<FeaturebaseEmbed
						src={featurebasePortalUrl({ surface: "roadmap", jwt })}
						title="Roadmap"
						fallbackTitle="Roadmap"
					/>
				</div>
			</main>
		</div>
	);
}
