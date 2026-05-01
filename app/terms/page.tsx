import { PublicNav } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

export default function TermsPage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
				<SectionHeader title="Terms of Service">
					<p>
						Use ExamPull only with materials you have the right to upload and study
						from.
					</p>
				</SectionHeader>
				<GlassPanel className="mt-8 space-y-4 p-6 text-sm leading-7 text-muted">
					<p>
						These build-phase terms cover account ownership, credit usage, uploaded
						materials, generated exams, refunds, subscriptions, and acceptable use. Full
						legal copy will be finalized before launch.
					</p>
					<p>
						User-uploaded materials remain private and are never used to train models.
						Abuse, copyright violations, or attempts to bypass credit rules can result
						in suspension.
					</p>
				</GlassPanel>
			</main>
		</div>
	);
}
