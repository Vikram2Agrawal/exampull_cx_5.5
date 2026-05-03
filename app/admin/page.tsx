import { AdminCard, AdminShell } from "@/components/admin/admin-shell";
import { getAdminOverview, listAdminQueueItems } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
	const [overview, queueItems] = await Promise.all([getAdminOverview(), listAdminQueueItems(8)]);

	return (
		<AdminShell active="Overview">
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-semibold">Overview</h1>
					<p className="mt-1 text-sm text-slate-500">
						Platform health, queue depth, spend, failures, and operator action items.
					</p>
				</div>
				<section className="grid gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 md:grid-cols-[1fr_auto] md:items-center">
					<div>
						<h2 className="font-semibold">Needs operator attention</h2>
						<p className="mt-1">
							{overview.failedExamCount} failed exams, {overview.openAbuseCount} abuse
							reports, and {overview.openFeedbackCount} feedback items are open.
						</p>
					</div>
					<a
						href="/admin/operations"
						className="inline-flex min-h-10 items-center justify-center rounded-md bg-red-900 px-3 text-sm font-medium text-white"
					>
						Open queue
					</a>
				</section>
				<div className="grid gap-4 md:grid-cols-4">
					<AdminCard
						title="Users"
						value={overview.userCount.toString()}
						description={`${overview.testUserCount} tagged test accounts`}
					/>
					<AdminCard
						title="Open triage"
						value={(overview.openFeedbackCount + overview.openAbuseCount).toString()}
						description="Feedback and abuse reports"
					/>
					<AdminCard
						title="Exams 24h"
						value={overview.recentExamCount.toString()}
						description={`${overview.completeExamCount} complete, ${overview.failedExamCount} failed`}
					/>
					<AdminCard
						title="Credits consumed"
						value={overview.creditsConsumed.toString()}
						description="All generated artifacts"
					/>
				</div>
				<div className="grid gap-4 lg:grid-cols-2">
					<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
						<h2 className="font-semibold">Action items</h2>
						<ul className="mt-4 space-y-3 text-sm text-slate-600">
							<li>{overview.openFeedbackCount} open feedback items</li>
							<li>{overview.openAbuseCount} open abuse reports</li>
							<li>{overview.failedExamCount} failed exams requiring review</li>
						</ul>
					</section>
					<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
						<h2 className="font-semibold">System health</h2>
						<ul className="mt-4 space-y-2 text-sm text-slate-600">
							<li>App Hosting: deployed</li>
							<li>LaTeX service: deployed behind IAM</li>
							<li>Queue watchlist: {queueItems.length} active or failed jobs</li>
							<li>
								Average rating:{" "}
								{overview.averageRating ? overview.averageRating.toFixed(1) : "--"}
							</li>
						</ul>
					</section>
				</div>
			</div>
		</AdminShell>
	);
}
