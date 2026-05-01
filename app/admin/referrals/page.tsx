import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { listAdminReferrals } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function dateLabel(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

export default async function AdminReferralsPage() {
	const referrals = await listAdminReferrals();

	return (
		<AdminShell active="Referrals">
			<AdminTable
				title="Referrals"
				description="Referral funnel, reward grants, suspicious patterns, and manual overrides."
				headers={["Referrer", "Referred", "Status", "Credits", "Created"]}
				empty="No referrals yet."
				rows={referrals.map((referral) => ({
					key: referral.id,
					cells: [
						referral.referrerUserId,
						referral.referredUserId ?? "--",
						referral.status,
						referral.creditsGranted,
						dateLabel(referral.createdAt),
					],
				}))}
			/>
		</AdminShell>
	);
}
