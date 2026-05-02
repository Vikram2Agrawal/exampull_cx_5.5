import { SupportForm } from "@/components/feedback/support-form";
import { PublicNav } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

export default function SupportPage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_460px]">
				<SectionHeader title="Support">
					<p>
						Tell us what happened. Support requests become operator-visible tickets in
						admin.
					</p>
				</SectionHeader>
				<GlassPanel className="p-6">
					<SupportForm />
				</GlassPanel>
			</main>
		</div>
	);
}
