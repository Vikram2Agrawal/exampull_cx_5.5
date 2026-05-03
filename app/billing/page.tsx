import { Package, RefreshCw } from "lucide-react";
import { redirect } from "next/navigation";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { PortalButton } from "@/components/billing/portal-button";
import { AppShell } from "@/components/layout/site-nav";
import { Button } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { CREDIT_PACK_PRICES, TIER_MONTHLY_CREDITS } from "@/lib/product/constants";
import { listUserRefundHistory } from "@/lib/user/data";
import { formatCurrency } from "@/lib/utils";

export default async function BillingPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-up");
	}

	const refunds = await listUserRefundHistory(user.uid);
	const planRank = { free: 0, scholar: 1, guru: 2 }[user.tier];
	const subscriptionPlans = [
		{
			tier: "scholar" as const,
			title: "Scholar",
			credits: TIER_MONTHLY_CREDITS.scholar,
			description:
				"Answer keys, Power Mode, grading, and enough monthly credits for steady practice.",
			monthlySku: "scholar_monthly" as const,
			annualSku: "scholar_annual" as const,
		},
		{
			tier: "guru" as const,
			title: "Guru",
			credits: TIER_MONTHLY_CREDITS.guru,
			description:
				"Visual annotations, rollover, and a high-volume credit pool for demanding courses.",
			monthlySku: "guru_monthly" as const,
			annualSku: "guru_annual" as const,
		},
	];

	return (
		<AppShell
			active="settings"
			unreadNotificationCount={user.unreadNotificationCount}
			theme={user.theme}
		>
			<div className="space-y-8">
				<SectionHeader title="Billing">
					<p>
						You are on <span className="capitalize">{user.tier}</span> with{" "}
						{user.credits} credits ready to use.
					</p>
					{user.subscriptionStatus === "grace_period" && user.paymentFailureGraceUntil ? (
						<p className="text-error">
							Payment needs attention before{" "}
							{new Intl.DateTimeFormat("en", {
								month: "short",
								day: "numeric",
								hour: "numeric",
								minute: "2-digit",
							}).format(new Date(user.paymentFailureGraceUntil))}
							. Paid features remain active during this grace period.
						</p>
					) : null}
				</SectionHeader>
				<div className="grid gap-4 lg:grid-cols-3">
					{subscriptionPlans.map((plan) => {
						const isCurrentPlan = user.tier === plan.tier;
						const isIncluded = planRank > { scholar: 1, guru: 2 }[plan.tier];

						return (
							<GlassPanel
								key={plan.tier}
								className={isCurrentPlan ? "border-brand/35 p-6" : "p-6"}
							>
								<div className="flex items-start justify-between gap-4">
									<RefreshCw
										aria-hidden="true"
										className={isCurrentPlan ? "text-brand" : "text-secondary"}
										size={22}
									/>
									{isCurrentPlan ? (
										<span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
											Current plan
										</span>
									) : null}
								</div>
								<h2 className="mt-4 text-xl font-semibold">{plan.title}</h2>
								<p className="mt-2 text-sm text-muted">
									{plan.credits} credits monthly. {plan.description}
								</p>
								{isCurrentPlan ? (
									<Button type="button" className="mt-5" disabled>
										Current plan
									</Button>
								) : isIncluded ? (
									<Button type="button" className="mt-5" disabled>
										Included in Guru
									</Button>
								) : (
									<>
										<CheckoutButton sku={plan.monthlySku} variant="premium">
											Upgrade monthly
										</CheckoutButton>
										<CheckoutButton sku={plan.annualSku}>
											{plan.title} annual
										</CheckoutButton>
									</>
								)}
							</GlassPanel>
						);
					})}
					{Object.entries(CREDIT_PACK_PRICES).map(([key, cents]) => (
						<GlassPanel key={key} className="p-6">
							<Package aria-hidden="true" className="text-secondary" size={22} />
							<h2 className="mt-4 text-xl font-semibold">
								{key.replace("pack", "")} credits
							</h2>
							<p className="mt-2 text-sm text-muted">
								{formatCurrency(cents)} one-time pack.
							</p>
							<CheckoutButton
								sku={
									key === "pack20"
										? "credits_20"
										: key === "pack100"
											? "credits_100"
											: "credits_240"
								}
							>
								Buy pack
							</CheckoutButton>
						</GlassPanel>
					))}
				</div>
				<GlassPanel className="p-6">
					<h2 className="text-xl font-semibold">Receipts and payment methods</h2>
					<p className="mt-2 text-sm text-muted">
						Open Stripe Billing to update payment methods, review invoices, or cancel at
						period end.
					</p>
					<div className="mt-5">
						<PortalButton />
					</div>
				</GlassPanel>
				<GlassPanel className="p-6">
					<h2 className="text-xl font-semibold">Refund history</h2>
					{refunds.length > 0 ? (
						<div className="mt-4 divide-y divide-border">
							{refunds.map((refund) => (
								<div key={refund.id} className="py-3 text-sm">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<p className="font-medium capitalize">
											{refund.refundType} refund
										</p>
										<p className="text-muted">
											{new Intl.DateTimeFormat("en", {
												month: "short",
												day: "numeric",
												hour: "numeric",
												minute: "2-digit",
											}).format(new Date(refund.createdAt))}
										</p>
									</div>
									<p className="mt-1 text-muted">
										{refund.creditAmount > 0
											? `${refund.creditAmount} credits`
											: null}
										{refund.creditAmount > 0 && refund.cashAmountCents > 0
											? " and "
											: null}
										{refund.cashAmountCents > 0
											? formatCurrency(refund.cashAmountCents)
											: null}
										{" · "}
										{refund.status}
									</p>
									{refund.note ? (
										<p className="mt-1 text-xs text-muted">{refund.note}</p>
									) : null}
								</div>
							))}
						</div>
					) : (
						<p className="mt-2 text-sm text-muted">
							Approved refunds and credit restorations will appear here.
						</p>
					)}
				</GlassPanel>
			</div>
		</AppShell>
	);
}
