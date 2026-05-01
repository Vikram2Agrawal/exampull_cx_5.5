import { PublicNav } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

const roadmap = [
	{ status: "Planned", items: ["Native mobile apps", "Spaced repetition", "LMS integration"] },
	{ status: "In Progress", items: ["LaTeX visual QA", "Power Mode", "Admin operations"] },
	{ status: "Shipped", items: ["Preview flow", "Credit model", "Class library"] },
] as const;

export default function RoadmapPage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
				<SectionHeader title="Roadmap">
					<p>Public product direction. Voting and comments require an account.</p>
				</SectionHeader>
				<div className="mt-10 grid gap-4 md:grid-cols-3">
					{roadmap.map((column) => (
						<GlassPanel key={column.status} className="p-5">
							<h2 className="text-xl font-semibold">{column.status}</h2>
							<ul className="mt-5 space-y-3">
								{column.items.map((item) => (
									<li
										key={item}
										className="rounded-lg bg-background/40 p-3 text-sm text-muted"
									>
										{item}
									</li>
								))}
							</ul>
						</GlassPanel>
					))}
				</div>
			</main>
		</div>
	);
}
