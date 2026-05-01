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

export default async function AdminCommunicationsPage() {
	const feedback = await listAdminFeedback("feedback");

	return (
		<AdminShell active="Communications">
			<AdminTable
				title="Communications"
				description="User feedback, support notes, feature requests, and outbound follow-up queue."
				headers={["Kind", "Title", "Body", "User", "Status", "Created"]}
				empty="No feedback submissions yet."
				rows={feedback.map((item) => ({
					key: item.id,
					cells: [
						item.kind,
						<p key="title" className="font-medium text-slate-950">
							{item.title}
						</p>,
						<p key="body" className="line-clamp-3 text-slate-600">
							{item.body}
						</p>,
						item.userId ?? "anonymous",
						<TriageAction
							key="status"
							collectionName="feedback"
							itemId={item.id}
							currentStatus={item.status}
						/>,
						dateLabel(item.createdAt),
					],
				}))}
			/>
		</AdminShell>
	);
}
