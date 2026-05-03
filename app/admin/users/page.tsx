import { AccountSuspensionForm } from "@/components/admin/account-suspension-form";
import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { CreditGrantForm } from "@/components/admin/credit-grant-form";
import { TierOverrideForm } from "@/components/admin/tier-override-form";
import { listAdminUsers } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function dateLabel(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

export default async function AdminUsersPage() {
	const users = await listAdminUsers();

	return (
		<AdminShell active="Users">
			<div className="space-y-6">
				<section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
					<h2 className="font-semibold">Operator context is required before action</h2>
					<p className="mt-1">
						Credit, tier, and suspension controls are still available here, but use the
						row ID only after confirming the target account from search or support
						context. Detail sheets are the next admin UX priority.
					</p>
				</section>
				<CreditGrantForm />
				<TierOverrideForm />
				<AccountSuspensionForm />
				<AdminTable
					title="Users"
					description="Organic and test accounts, credits, spend, and activity."
					headers={[
						"Email",
						"Tier",
						"Status",
						"Credits",
						"Reserved",
						"Consumed",
						"Tags",
						"Created",
					]}
					empty="No users yet."
					rows={users.map((user) => ({
						key: user.id,
						cells: [
							<div key="email">
								<p className="font-medium text-slate-950">{user.email}</p>
								<p className="mt-1 text-xs text-slate-500">{user.id}</p>
							</div>,
							<span key="tier" className="capitalize">
								{user.tier}
								{user.tierOverride ? (
									<span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
										override
									</span>
								) : null}
							</span>,
							<div key="status" className="space-y-1">
								<span
									className={
										user.accountStatus === "suspended"
											? "rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
											: "rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
									}
								>
									{user.accountStatus.replaceAll("_", " ")}
								</span>
								{user.suspensionReason ? (
									<p className="max-w-48 text-xs text-slate-500">
										{user.suspensionReason}
									</p>
								) : null}
							</div>,
							user.credits,
							user.reservedCredits,
							user.totalCreditsConsumed,
							user.isTestAccount ? (
								<span
									key="test"
									className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900"
								>
									test
								</span>
							) : (
								<span key="organic" className="text-slate-500">
									organic
								</span>
							),
							dateLabel(user.createdAt),
						],
					}))}
				/>
			</div>
		</AdminShell>
	);
}
