import { FeaturebaseEmbed } from "@/components/feedback/featurebase-embed";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { PublicNav } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { createFeaturebaseJwt, featurebasePortalUrl } from "@/lib/featurebase/sso";

export default async function FeedbackPage() {
	const user = await getCurrentUser();
	const jwt = user ? await createFeaturebaseJwt(user) : null;

	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px]">
				<div>
					<SectionHeader title="Feedback">
						<p>
							Browse product requests, vote after sign-in, or send private notes into
							the support queue.
						</p>
					</SectionHeader>
					<div className="mt-8">
						<FeaturebaseEmbed
							src={featurebasePortalUrl({ surface: "feedback", jwt })}
							title="Featurebase feedback board"
							fallbackTitle="Feedback board"
						/>
					</div>
				</div>
				<GlassPanel className="h-fit p-6">
					<FeedbackForm source="feedback_page" />
				</GlassPanel>
			</main>
		</div>
	);
}
