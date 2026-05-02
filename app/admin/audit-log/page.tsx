import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { listAdminAudit } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function dateLabel(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

export default async function AdminAuditLogPage() {
	const rows = await listAdminAudit();

	return (
		<AdminShell active="Audit Log">
			<AdminTable
				title="Audit log"
				description="Operator actions, sensitive reads, credits, refunds, and account operations."
				headers={["Seq", "Action", "Target", "Details", "Hash", "Created"]}
				empty="No admin actions recorded yet."
				rows={rows.map((row) => ({
					key: row.id,
					cells: [
						row.sequence ?? "--",
						<p key="action" className="font-medium text-slate-950">
							{row.action}
						</p>,
						row.target,
						<p key="details" className="line-clamp-3 text-slate-600">
							{row.details}
						</p>,
						<p key="hash" className="font-mono text-xs text-slate-500">
							{row.hash ? row.hash.slice(0, 12) : "legacy"}
						</p>,
						dateLabel(row.createdAt),
					],
				}))}
			/>
		</AdminShell>
	);
}
