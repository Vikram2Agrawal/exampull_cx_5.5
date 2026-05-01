import { PublicNav } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

const entries = [
	{
		date: "2026-05-01",
		title: "Build system initialized",
		body: "Project scaffold, design tokens, route surfaces, and stopguard controls landed.",
	},
	{
		date: "2026-04-28",
		title: "Admin PRD finalized",
		body: "Operator dashboard scope locked for build-phase path-based admin.",
	},
] as const;

export default function ChangelogPage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
				<SectionHeader title="Changelog">
					<p>
						Product changes, generated from the same customer-voice system as the
						roadmap.
					</p>
				</SectionHeader>
				<div className="mt-10 space-y-4">
					{entries.map((entry) => (
						<GlassPanel key={entry.title} className="p-5">
							<p className="text-sm text-secondary">{entry.date}</p>
							<h2 className="mt-2 text-xl font-semibold">{entry.title}</h2>
							<p className="mt-2 text-sm leading-6 text-muted">{entry.body}</p>
						</GlassPanel>
					))}
				</div>
			</main>
		</div>
	);
}
