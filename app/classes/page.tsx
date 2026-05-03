import { ArrowRight, FileUp, GraduationCap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserClasses } from "@/lib/classes/data";
import { educationLevelLabel } from "@/lib/product/constants";

export default async function ClassesPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-up");
	}

	const classes = await listUserClasses(user.uid);

	return (
		<AppShell
			active="classes"
			unreadNotificationCount={user.unreadNotificationCount}
			theme={user.theme}
		>
			<div className="space-y-8">
				<div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
					<SectionHeader title="Classes">
						<p>
							Keep source materials, syllabus context, instructor style guides, and
							generated exams organized by course.
						</p>
					</SectionHeader>
					<ButtonLink href="/classes/new" variant="primary">
						Add class
					</ButtonLink>
				</div>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{classes.length === 0 ? (
						<GlassPanel className="p-8 text-center md:col-span-2 xl:col-span-3">
							<h2 className="text-xl font-semibold">No classes yet</h2>
							<p className="mt-2 text-sm text-muted">
								Create a class to keep materials, style guides, and exams together.
							</p>
							<ButtonLink href="/classes/new" variant="primary" className="mt-5">
								Add class
							</ButtonLink>
						</GlassPanel>
					) : null}
					{classes.map((course) => (
						<GlassPanel key={course.id} className="p-5" interactive>
							<div className="flex items-start justify-between gap-4">
								<div>
									<span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
										<GraduationCap aria-hidden="true" size={22} />
									</span>
									<Link
										href={`/classes/${course.id}`}
										className="mt-5 block text-xl font-semibold hover:text-brand"
									>
										{course.name}
									</Link>
									<p className="mt-2 text-sm text-muted">{course.institution}</p>
								</div>
								<div className="flex flex-col items-end gap-2">
									<span className="rounded-full border border-glass-border px-3 py-1 text-xs text-muted">
										{educationLevelLabel(course.educationLevel)}
									</span>
									{course.archived ? (
										<span className="rounded-full bg-glass px-3 py-1 text-xs text-muted">
											Archived
										</span>
									) : null}
								</div>
							</div>
							<div className="mt-5 grid grid-cols-2 gap-3 text-sm">
								<div className="rounded-lg border border-glass-border bg-background/40 p-3">
									<p className="text-muted">Materials</p>
									<p className="mt-1 font-semibold">{course.materialCount}</p>
								</div>
								<div className="rounded-lg border border-glass-border bg-background/40 p-3">
									<p className="text-muted">Style guide</p>
									<p className="mt-1 font-semibold">
										{course.styleGuideStatus.replaceAll("_", " ")}
									</p>
								</div>
							</div>
							<div className="mt-5 rounded-lg border border-glass-border bg-background/35 p-3 text-sm text-muted">
								{course.materialCount > 0
									? "Ready to generate a course-grounded practice exam."
									: "Add slides, notes, or a syllabus before generating from this class."}
							</div>
							<div className="mt-5 grid gap-2 sm:grid-cols-2">
								<ButtonLink
									href={`/classes/${course.id}`}
									variant="secondary"
									className="w-full"
								>
									Open class
								</ButtonLink>
								<ButtonLink
									href={
										course.materialCount > 0
											? `/exams/new?classId=${course.id}`
											: `/classes/${course.id}`
									}
									variant={course.materialCount > 0 ? "primary" : "secondary"}
									className="w-full"
								>
									{course.materialCount > 0 ? (
										<>
											<ArrowRight aria-hidden="true" size={16} />
											Create exam
										</>
									) : (
										<>
											<FileUp aria-hidden="true" size={16} />
											Add material
										</>
									)}
								</ButtonLink>
							</div>
						</GlassPanel>
					))}
				</div>
			</div>
		</AppShell>
	);
}
