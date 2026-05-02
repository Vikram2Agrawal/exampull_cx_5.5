import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { ReferralOverrideControls } from "@/components/admin/referral-override-controls";
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
				headers={[
					"Referrer",
					"Referred",
					"Status",
					"Rewards",
					"Review",
					"Created",
					"Override",
				]}
				empty="No referrals yet."
				rows={referrals.map((referral) => ({
					key: referral.id,
					cells: [
						referral.referrerUserId,
						referral.referredUserId ?? "--",
						referral.status,
						`${referral.creditsGranted} credits; ${referral.scholarMonthsGranted} Scholar; ${referral.guruMonthsGranted} Guru`,
						referral.suspicious ? (
							<span key={`${referral.id}-review`} className="text-amber-700">
								{referral.reviewStatus}: {referral.suspiciousReasons.join(", ")}
							</span>
						) : (
							referral.reviewStatus
						),
						dateLabel(referral.createdAt),
						<ReferralOverrideControls
							key={`${referral.id}-override`}
							referralId={referral.id}
						/>,
					],
				}))}
			/>
		</AdminShell>
	);
}
