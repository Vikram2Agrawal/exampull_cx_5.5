import { AdminCard, AdminShell } from "@/components/admin/admin-shell";
import { getAdminOverview } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
	const overview = await getAdminOverview();
	const completionRate =
		overview.examCount > 0
			? Math.round((overview.completeExamCount / overview.examCount) * 100)
			: 0;

	return (
		<AdminShell active="Analytics">
			<div className="space-y-6">
				<h1 className="text-2xl font-semibold">Analytics</h1>
				<div className="grid gap-4 md:grid-cols-4">
					<AdminCard
						title="Completion"
						value={`${completionRate}%`}
						description="Generated exams reaching complete"
					/>
					<AdminCard
						title="Engagement"
						value={overview.creditsConsumed.toString()}
						description="Credits consumed"
					/>
					<AdminCard
						title="Failures"
						value={overview.failedExamCount.toString()}
						description="Generation failures"
					/>
					<AdminCard
						title="Quality"
						value={overview.averageRating ? overview.averageRating.toFixed(1) : "--"}
						description="Average user rating"
					/>
				</div>
				<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="font-semibold">Funnel</h2>
					<div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
						<p>{overview.userCount} accounts</p>
						<p>{overview.examCount} exams created</p>
						<p>{overview.completeExamCount} exams completed</p>
						<p>{overview.openFeedbackCount} open feedback items</p>
					</div>
				</section>
			</div>
		</AdminShell>
	);
}
