import { PublicNav } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

export default function PrivacyPage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
				<SectionHeader title="Privacy Policy">
					<p>
						ExamPull stores student materials privately and exposes only profile-level
						data to feedback tooling.
					</p>
				</SectionHeader>
				<GlassPanel className="mt-8 space-y-4 p-6 text-sm leading-7 text-muted">
					<p>
						The platform stores uploaded materials, generated PDFs, attempts, credit
						ledger entries, and feedback for account use. Account deletion triggers a
						full data wipe and sanitizes aggregate feedback records.
					</p>
					<p>
						Featurebase receives display name, avatar, email, and tier only. It never
						receives exam content, class names, materials, attempts, phone numbers, or
						payment data.
					</p>
				</GlassPanel>
			</main>
		</div>
	);
}
