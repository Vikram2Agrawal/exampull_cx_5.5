import { Check, Coins } from "lucide-react";
import { PublicNav } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { CREDIT_PACK_PRICES, TIER_MAX_QUESTIONS_PER_EXAM } from "@/lib/product/constants";
import { formatCurrency } from "@/lib/utils";

const tiers = [
	{
		name: "Free",
		price: "$0",
		credits: "40 credits monthly",
		cta: "Start free",
		href: "/sign-up",
		features: [
			"12 questions per exam",
			"Exam PDF download",
			"Try one Scholar-level exam after your first PDF",
			"Upgrade when you want answer keys and grading",
		],
	},
	{
		name: "Scholar",
		price: "$5/mo",
		credits: "400 credits monthly",
		cta: "Upgrade to Scholar",
		href: "/sign-up?plan=scholar",
		features: [
			"25 questions per exam",
			"Separate answer keys",
			"Control question type and difficulty",
			"Upload your attempt for grading",
		],
	},
	{
		name: "Guru",
		price: "$20/mo",
		credits: "4,000 credits monthly",
		cta: "Upgrade to Guru",
		href: "/sign-up?plan=guru",
		features: [
			"100 questions per exam",
			"Marked-up feedback on your submitted work",
			"Credit rollover",
			"Built for heavier course loads",
		],
	},
] as const;

export default function PricingPage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
				<SectionHeader title="Credits scale with the work you ask for">
					<p>
						Generation, grading, annotations, and style guides all use whole-number
						credits so pricing is easy to predict.
					</p>
				</SectionHeader>
				<div className="mt-12 grid gap-4 lg:grid-cols-3">
					{tiers.map((tier) => (
						<GlassPanel key={tier.name} className="flex flex-col p-6">
							<div className="flex items-center justify-between">
								<h2 className="text-2xl font-semibold">{tier.name}</h2>
								<span className="rounded-full border border-premium px-3 py-1 text-xs font-semibold text-premium">
									{tier.credits}
								</span>
							</div>
							<p className="mt-6 text-4xl font-semibold">{tier.price}</p>
							<ul className="mt-8 flex-1 space-y-3 text-sm text-muted">
								{tier.features.map((feature) => (
									<li key={feature} className="flex gap-2">
										<Check
											aria-hidden="true"
											className="mt-0.5 text-success"
											size={16}
										/>
										{feature}
									</li>
								))}
							</ul>
							<ButtonLink
								href={tier.href}
								variant={tier.name === "Free" ? "primary" : "premium"}
								className="mt-8"
							>
								{tier.cta}
							</ButtonLink>
						</GlassPanel>
					))}
				</div>
				<GlassPanel className="mt-10 p-6">
					<div className="flex items-start gap-4">
						<Coins aria-hidden="true" className="text-secondary" size={24} />
						<div>
							<h2 className="text-xl font-semibold">Credit math</h2>
							<p className="mt-2 text-sm leading-6 text-muted">
								Generate one question for 2 credits, grade one question for 1
								credit, and add visual annotations for 4 credits per question.
								Credit packs start at {formatCurrency(CREDIT_PACK_PRICES.pack20)}{" "}
								for 20 credits.
							</p>
							<p className="mt-2 text-sm text-muted">
								Tier limits: Free {TIER_MAX_QUESTIONS_PER_EXAM.free}, Scholar{" "}
								{TIER_MAX_QUESTIONS_PER_EXAM.scholar}, Guru{" "}
								{TIER_MAX_QUESTIONS_PER_EXAM.guru} questions per exam.
							</p>
						</div>
					</div>
				</GlassPanel>
			</main>
		</div>
	);
}
