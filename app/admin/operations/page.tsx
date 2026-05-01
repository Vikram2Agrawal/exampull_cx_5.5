import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { listAdminQueueItems } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function dateLabel(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

export default async function AdminOperationsPage() {
	const queueItems = await listAdminQueueItems();

	return (
		<AdminShell active="Operations">
			<div className="space-y-6">
				<AdminTable
					title="Operations"
					description="Queued, active, failed, and queue-warning generation jobs."
					headers={["Exam", "User", "Status", "Failure", "Queue warning", "Updated"]}
					empty="No active or failed jobs."
					rows={queueItems.map((item) => ({
						key: `${item.userId}-${item.id}`,
						cells: [
							<div key="exam">
								<p className="font-medium text-slate-950">{item.title}</p>
								<p className="mt-1 text-xs text-slate-500">{item.id}</p>
							</div>,
							<span key="user" className="text-xs text-slate-500">
								{item.userId}
							</span>,
							item.status.replaceAll("_", " "),
							item.failureReason ?? "--",
							item.queueWarning ?? "--",
							dateLabel(item.updatedAt),
						],
					}))}
				/>
				<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="font-semibold">Manual operations</h2>
					<p className="mt-2 text-sm text-slate-500">
						Credit grants, refunds, re-runs, and suspensions are exposed through audited
						admin APIs and will appear in the audit log as they are used.
					</p>
				</section>
			</div>
		</AdminShell>
	);
}
