import { FeedbackForm } from "@/components/feedback/feedback-form";
import { PublicNav } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

export default function FeedbackPage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_460px]">
				<SectionHeader title="Feedback">
					<p>
						Feature requests are public after sign-in. Bugs and general feedback go to
						support.
					</p>
				</SectionHeader>
				<GlassPanel className="p-6">
					<FeedbackForm />
				</GlassPanel>
			</main>
		</div>
	);
}
