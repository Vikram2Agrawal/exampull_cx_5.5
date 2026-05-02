import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { CommunicationComposer } from "@/components/admin/communication-composer";
import { TriageAction } from "@/components/admin/triage-action";
import { listAdminCommunications, listAdminFeedback } from "@/lib/admin/data";

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
	const [feedback, communications] = await Promise.all([
		listAdminFeedback("feedback"),
		listAdminCommunications(),
	]);

	return (
		<AdminShell active="Communications">
			<div className="space-y-6">
				<CommunicationComposer />
				<AdminTable
					title="Outbound Communications"
					description="Transactional email and SMS sends, provider outcomes, and user-facing bodies."
					headers={[
						"Kind",
						"Channel",
						"Subject",
						"Body",
						"Recipient",
						"Status",
						"Created",
					]}
					empty="No outbound communications yet."
					rows={communications.map((item) => ({
						key: item.id,
						cells: [
							item.kind,
							item.channel,
							<p key="subject" className="font-medium text-slate-950">
								{item.subject}
							</p>,
							<p key="body" className="line-clamp-3 text-slate-600">
								{item.body}
							</p>,
							<div key="recipient" className="space-y-1 text-slate-600">
								<p>{item.email ?? item.phoneNumber ?? item.userId ?? "unknown"}</p>
								{item.providerId ? (
									<p className="text-xs text-slate-400">{item.providerId}</p>
								) : null}
								{item.errorMessage ? (
									<p className="text-xs text-error">{item.errorMessage}</p>
								) : null}
							</div>,
							item.status,
							dateLabel(item.createdAt),
						],
					}))}
				/>
				<AdminTable
					title="Support Inbox"
					description="User feedback, support notes, and feature requests that need operator triage."
					headers={["Kind", "Title", "Body", "Source", "User", "Status", "Created"]}
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
							<div key="source" className="space-y-1 text-slate-600">
								<p>{item.source}</p>
								<p className="text-xs text-slate-400">{item.visibility}</p>
							</div>,
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
			</div>
		</AdminShell>
	);
}
