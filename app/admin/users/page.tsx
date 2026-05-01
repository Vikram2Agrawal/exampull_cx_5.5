import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { CreditGrantForm } from "@/components/admin/credit-grant-form";
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
				<CreditGrantForm />
				<AdminTable
					title="Users"
					description="Organic and test accounts, credits, spend, and activity."
					headers={[
						"Email",
						"Tier",
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
							</span>,
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
