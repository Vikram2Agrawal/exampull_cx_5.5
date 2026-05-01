import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { TriageAction } from "@/components/admin/triage-action";
import { listAdminFeedback } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function dateLabel(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

export default async function AdminAbusePage() {
	const reports = await listAdminFeedback("abuseReports");

	return (
		<AdminShell active="Abuse">
			<AdminTable
				title="Abuse and triage"
				description="Reported exams, copyright flags, source moderation, and anomalous usage."
				headers={["Kind", "Target", "Reason", "User", "Status", "Created"]}
				empty="No abuse reports yet."
				rows={reports.map((report) => ({
					key: report.id,
					cells: [
						report.kind,
						<p key="target" className="font-medium text-slate-950">
							{report.title}
						</p>,
						<p key="body" className="line-clamp-3 text-slate-600">
							{report.body}
						</p>,
						report.userId ?? "unknown",
						<TriageAction
							key="status"
							collectionName="abuseReports"
							itemId={report.id}
							currentStatus={report.status}
						/>,
						dateLabel(report.createdAt),
					],
				}))}
			/>
		</AdminShell>
	);
}
