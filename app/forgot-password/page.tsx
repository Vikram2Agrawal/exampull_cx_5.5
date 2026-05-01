import { PublicNav } from "@/components/layout/site-nav";
import { Button } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

export default function ForgotPasswordPage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
				<SectionHeader title="Reset your password">
					<p>
						Send a reset link to a linked email, then use phone verification as recovery
						backup.
					</p>
				</SectionHeader>
				<GlassPanel className="mt-8 p-6">
					<label className="text-sm font-medium" htmlFor="email">
						Account email
					</label>
					<input
						id="email"
						type="email"
						className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
					/>
					<Button type="button" variant="primary" className="mt-5">
						Send reset link
					</Button>
				</GlassPanel>
			</main>
		</div>
	);
}
