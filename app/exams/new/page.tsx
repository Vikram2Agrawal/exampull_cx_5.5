import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { NewExamForm } from "@/components/exam/new-exam-form";
import { AppShell } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listClassMaterials, listUserClasses } from "@/lib/classes/data";
import { listUserExams } from "@/lib/exams/data";

const steps = ["Sources", "Topics", "Configure"];

export default async function NewExamPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	const [classes, priorExams] = await Promise.all([
		listUserClasses(user.uid),
		listUserExams(user.uid, { limit: 2, includeArchived: true }),
	]);
	const sourceClasses = await Promise.all(
		classes
			.filter((course) => !course.archived)
			.map(async (course) => ({
				...course,
				materials: await listClassMaterials(user.uid, course.id),
			})),
	);

	return (
		<AppShell active="exams">
			<div className="space-y-8">
				<SectionHeader title="Create an exam">
					<p>
						Combine classes, ad hoc files, and manual topics. Review extracted topics
						before credits are reserved.
					</p>
				</SectionHeader>
				<div className="grid gap-5 lg:grid-cols-[240px_1fr]">
					<GlassPanel className="p-4">
						<ol className="space-y-2">
							{steps.map((step, index) => (
								<li key={step} className="rounded-lg bg-background/40 p-3 text-sm">
									<span className="mr-2 text-secondary">{index + 1}</span>
									{step}
								</li>
							))}
						</ol>
					</GlassPanel>
					<GlassPanel className="p-6">
						<div className="grid gap-4 md:grid-cols-3">
							<ActionCard
								title="Add classes"
								description="Include stored class materials."
							/>
							<ActionCard
								title="Upload files"
								description="PDF, docx, pptx, text, or images."
							/>
							<ActionCard
								title="Manual topics"
								description="Generate from typed topics only."
							/>
						</div>
						<div className="mt-6">
							<NewExamForm
								tier={user.tier}
								credits={user.credits}
								boostAvailable={user.tier === "free" && !user.boostUsedAt}
								priorExamCount={priorExams.length}
								classes={sourceClasses}
							/>
						</div>
					</GlassPanel>
				</div>
			</div>
		</AppShell>
	);
}

function ActionCard({ title, description }: { title: string; description: string }) {
	return (
		<button
			type="button"
			className="min-h-32 rounded-lg border border-glass-border bg-background/40 p-4 text-left hover:bg-glass"
		>
			<Plus aria-hidden="true" className="text-secondary" size={20} />
			<h2 className="mt-4 font-semibold">{title}</h2>
			<p className="mt-1 text-sm text-muted">{description}</p>
		</button>
	);
}
