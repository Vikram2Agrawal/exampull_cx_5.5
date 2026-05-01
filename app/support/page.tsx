import { Bug, CreditCard, LifeBuoy } from "lucide-react";
import { PublicNav } from "@/components/layout/site-nav";
import { Button } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

const reasons = [
	{ label: "Refund request", icon: CreditCard },
	{ label: "Bug report", icon: Bug },
	{ label: "General help", icon: LifeBuoy },
] as const;

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
					<div className="grid gap-3">
						{reasons.map((reason) => {
							const Icon = reason.icon;

							return (
								<button
									key={reason.label}
									type="button"
									className="flex min-h-12 items-center gap-3 rounded-lg border border-glass-border bg-background/40 px-3 text-left text-sm hover:bg-glass"
								>
									<Icon aria-hidden="true" className="text-secondary" size={18} />
									{reason.label}
								</button>
							);
						})}
					</div>
					<textarea
						className="mt-5 min-h-32 w-full rounded-lg border border-glass-border bg-background/70 p-3 outline-none focus:ring-2 focus:ring-brand"
						placeholder="What should we know?"
					/>
					<Button type="button" variant="primary" className="mt-4">
						Send request
					</Button>
				</GlassPanel>
			</main>
		</div>
	);
}
