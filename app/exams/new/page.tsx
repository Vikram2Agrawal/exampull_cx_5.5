import { ClipboardCheck, FileUp, ListPlus } from "lucide-react";
import { redirect } from "next/navigation";
import { NewExamForm } from "@/components/exam/new-exam-form";
import { AppShell } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listClassMaterials, listUserClasses } from "@/lib/classes/data";
import { listUserExams } from "@/lib/exams/data";

const steps = ["Sources", "Topics", "Configure"];
const sourceOptions = [
	{
		title: "Use saved class materials",
		description: "Pull from slides, notes, and style references already in your classes.",
		icon: ClipboardCheck,
	},
	{
		title: "Upload files for this exam",
		description: "Add PDFs, documents, slide decks, text files, or images just for this run.",
		icon: FileUp,
	},
	{
		title: "Type manual topics",
		description: "Enter the exact topics or chapters you want represented in the exam.",
		icon: ListPlus,
	},
] as const;

export default async function NewExamPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	if (user.accountStatus === "suspended") {
		return (
			<AppShell
				active="exams"
				unreadNotificationCount={user.unreadNotificationCount}
				theme={user.theme}
			>
				<div className="space-y-8">
					<SectionHeader title="Build a practice exam">
						<p>Your existing library stays available while generation is paused.</p>
					</SectionHeader>
					<GlassPanel className="p-6">
						<h2 className="text-2xl font-semibold">Exam generation paused</h2>
						<p className="mt-2 max-w-2xl text-sm text-muted">
							Your account can still view and download existing exams, but new exam
							generation is disabled while an operator reviews the account.
						</p>
						<div className="mt-5 flex flex-wrap gap-3">
							<ButtonLink href="/exams">View library</ButtonLink>
							<ButtonLink href="/support" variant="ghost">
								Contact support
							</ButtonLink>
						</div>
					</GlassPanel>
				</div>
			</AppShell>
		);
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
		<AppShell
			active="exams"
			unreadNotificationCount={user.unreadNotificationCount}
			theme={user.theme}
		>
			<div className="space-y-8">
				<SectionHeader title="Build a practice exam">
					<p>
						Choose your source materials, confirm the topics, then set the length and
						style before credits are reserved.
					</p>
				</SectionHeader>
				<div className="grid gap-5 lg:grid-cols-[240px_1fr]">
					<GlassPanel className="p-4 lg:sticky lg:top-24 lg:self-start">
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
							{sourceOptions.map((option) => (
								<ActionCard key={option.title} {...option} />
							))}
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

function ActionCard({
	title,
	description,
	icon: Icon,
}: {
	title: string;
	description: string;
	icon: typeof ClipboardCheck;
}) {
	return (
		<div className="min-h-32 rounded-lg border border-glass-border bg-background/40 p-4">
			<Icon aria-hidden="true" className="text-secondary" size={20} />
			<h2 className="mt-4 font-semibold">{title}</h2>
			<p className="mt-1 text-sm text-muted">{description}</p>
		</div>
	);
}
