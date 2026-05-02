import { Package, RefreshCw } from "lucide-react";
import { redirect } from "next/navigation";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { PortalButton } from "@/components/billing/portal-button";
import { AppShell } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { CREDIT_PACK_PRICES, TIER_MONTHLY_CREDITS } from "@/lib/product/constants";
import { formatCurrency } from "@/lib/utils";

export default async function BillingPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	return (
		<AppShell active="settings" unreadNotificationCount={user.unreadNotificationCount}>
			<div className="space-y-8">
				<SectionHeader title="Billing">
					<p>
						Current tier: <span className="capitalize">{user.tier}</span>. Balance:{" "}
						{user.credits} credits.
					</p>
				</SectionHeader>
				<div className="grid gap-4 lg:grid-cols-3">
					<GlassPanel className="p-6">
						<RefreshCw aria-hidden="true" className="text-secondary" size={22} />
						<h2 className="mt-4 text-xl font-semibold">Scholar</h2>
						<p className="mt-2 text-sm text-muted">
							{TIER_MONTHLY_CREDITS.scholar} credits monthly, answer keys, Power Mode,
							grading.
						</p>
						<CheckoutButton sku="scholar_monthly" variant="premium">
							Upgrade monthly
						</CheckoutButton>
						<CheckoutButton sku="scholar_annual">Scholar annual</CheckoutButton>
					</GlassPanel>
					<GlassPanel className="p-6">
						<RefreshCw aria-hidden="true" className="text-premium" size={22} />
						<h2 className="mt-4 text-xl font-semibold">Guru</h2>
						<p className="mt-2 text-sm text-muted">
							{TIER_MONTHLY_CREDITS.guru} credits monthly, visual annotations, and
							rollover.
						</p>
						<CheckoutButton sku="guru_monthly" variant="premium">
							Upgrade monthly
						</CheckoutButton>
						<CheckoutButton sku="guru_annual">Guru annual</CheckoutButton>
					</GlassPanel>
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
			</div>
		</AppShell>
	);
}
