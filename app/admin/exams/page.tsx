import { AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { ExamRegenerateForm } from "@/components/admin/exam-regenerate-form";
import { listAdminExams } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function dateLabel(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

export default async function AdminExamsPage() {
	const exams = await listAdminExams();

	return (
		<AdminShell active="Exams">
			<div className="space-y-6">
				<ExamRegenerateForm />
				<AdminTable
					title="Exams"
					description="Generated artifacts, pipeline status, rating, and credit consumption."
					headers={[
						"Title",
						"User",
						"Status",
						"Tier",
						"Questions",
						"Credits",
						"Rating",
						"Created",
					]}
					empty="No exams yet."
					rows={exams.map((exam) => ({
						key: `${exam.userId}-${exam.id}`,
						cells: [
							<div key="title">
								<p className="font-medium text-slate-950">{exam.title}</p>
								<p className="mt-1 text-xs text-slate-500">{exam.id}</p>
							</div>,
							<span key="user" className="text-xs text-slate-500">
								{exam.userId}
							</span>,
							<span key="status" className="capitalize">
								{exam.status.replaceAll("_", " ")}
							</span>,
							<span key="tier" className="capitalize">
								{exam.tier}
							</span>,
							exam.questionCount,
							exam.creditsConsumed,
							exam.rating ?? "--",
							dateLabel(exam.createdAt),
						],
					}))}
				/>
			</div>
		</AdminShell>
	);
}
