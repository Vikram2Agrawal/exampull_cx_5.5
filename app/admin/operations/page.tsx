import { AccountSuspensionForm } from "@/components/admin/account-suspension-form";
import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { BulkCreditGrantForm } from "@/components/admin/bulk-credit-grant-form";
import { RefundActionForm } from "@/components/admin/refund-action-form";
import { listBulkCreditGrants } from "@/lib/admin/credits";
import { listAdminQueueItems, listSuspendedUsers } from "@/lib/admin/data";
import { listAdminRefundHistory, listAdminRefundRequests } from "@/lib/admin/refunds";
import { formatCurrency } from "@/lib/utils";

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
	const [queueItems, refundRequests, refundHistory, bulkGrants, suspendedUsers] =
		await Promise.all([
			listAdminQueueItems(),
			listAdminRefundRequests(),
			listAdminRefundHistory(),
			listBulkCreditGrants(),
			listSuspendedUsers(),
		]);

	return (
		<AdminShell active="Operations">
			<div className="space-y-6">
				<BulkCreditGrantForm />
				<AccountSuspensionForm />
				<AdminTable
					title="Refund requests"
					description="Open refund and chargeback-adjacent requests from support, exam reports, and recovery flows."
					headers={["Request", "User", "Exam", "Reason", "History", "Status", "Action"]}
					empty="No refund requests need action."
					rows={refundRequests.map((request) => ({
						key: request.id,
						cells: [
							<div key="request">
								<p className="font-medium text-slate-950">{request.title}</p>
								<p className="mt-1 text-xs text-slate-500">
									{request.sourceCollection}/{request.sourceId}
								</p>
							</div>,
							<div key="user" className="space-y-1 text-xs text-slate-500">
								<p>{request.email ?? "unknown email"}</p>
								<p>{request.userId ?? "anonymous"}</p>
							</div>,
							request.examId ?? "--",
							<p key="reason" className="line-clamp-4 text-slate-600">
								{request.reason}
							</p>,
							`${request.refundHistoryCount.toString()} prior`,
							request.status,
							<RefundActionForm
								key="action"
								sourceCollection={request.sourceCollection}
								sourceId={request.sourceId}
								defaultCredits={request.requestedCredits}
							/>,
						],
					}))}
				/>
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
						Credit grants, refunds, re-runs, and suspensions are exposed through
						re-authenticated admin APIs and appear in the audit log as they are used.
					</p>
				</section>
				<AdminTable
					title="Suspended accounts"
					description="Accounts that can still sign in and view their library but cannot generate new exams."
					headers={["User", "Reason", "Suspended by", "Suspended at"]}
					empty="No suspended accounts."
					rows={suspendedUsers.map((user) => ({
						key: user.id,
						cells: [
							<div key="user" className="space-y-1 text-xs text-slate-500">
								<p className="font-medium text-slate-950">{user.email}</p>
								<p>{user.id}</p>
							</div>,
							<p key="reason" className="line-clamp-3 text-slate-600">
								{user.reason}
							</p>,
							user.suspendedBy,
							dateLabel(user.suspendedAt),
						],
					}))}
				/>
				<AdminTable
					title="Refund history"
					description="Completed and escalated refund outcomes with credit/cash split and user-visible records."
					headers={[
						"User",
						"Source",
						"Type",
						"Credits",
						"Cash",
						"Status",
						"Note",
						"Created",
					]}
					empty="No refund history yet."
					rows={refundHistory.map((refund) => ({
						key: refund.id,
						cells: [
							<div key="user" className="space-y-1 text-xs text-slate-500">
								<p>{refund.email ?? "unknown email"}</p>
								<p>{refund.userId}</p>
							</div>,
							`${refund.sourceCollection}/${refund.sourceId}`,
							refund.refundType,
							refund.creditAmount,
							`${formatCurrency(refund.cashAmountCents)} · ${refund.cashStatus}`,
							refund.status,
							<p key="note" className="line-clamp-3 text-slate-600">
								{refund.note}
							</p>,
							dateLabel(refund.createdAt),
						],
					}))}
				/>
				<AdminTable
					title="Bulk credit grant history"
					description="Dry-run backed bulk grants, total credit exposure, and rollback window metadata."
					headers={[
						"Reason",
						"Audience",
						"Amount",
						"Recipients",
						"Total",
						"Status",
						"Rollback until",
						"Created",
					]}
					empty="No bulk grants yet."
					rows={bulkGrants.map((grant) => ({
						key: grant.id,
						cells: [
							<div key="reason">
								<p className="font-medium text-slate-950">{grant.reason}</p>
								<p className="mt-1 text-xs text-slate-500">{grant.id}</p>
							</div>,
							grant.audienceLabel,
							grant.amount,
							grant.recipientCount,
							grant.totalCredits,
							grant.status,
							dateLabel(grant.rollbackExpiresAt),
							dateLabel(grant.createdAt),
						],
					}))}
				/>
			</div>
		</AdminShell>
	);
}
