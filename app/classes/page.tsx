import { Archive, FileUp, GraduationCap, Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserClasses } from "@/lib/classes/data";

export default async function ClassesPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
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
				<div className="grid gap-4 lg:grid-cols-3">
					{classes.length === 0 ? (
						<GlassPanel className="p-8 text-center lg:col-span-3">
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
						<GlassPanel key={course.id} className="p-6" interactive>
							<div className="flex items-start justify-between gap-4">
								<div>
									<GraduationCap
										aria-hidden="true"
										className="text-secondary"
										size={24}
									/>
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
										{course.educationLevel}/100
									</span>
									{course.archived ? (
										<span className="rounded-full bg-glass px-3 py-1 text-xs text-muted">
											Archived
										</span>
									) : null}
								</div>
							</div>
							<div className="mt-6 grid grid-cols-2 gap-3 text-sm">
								<div className="rounded-lg bg-background/40 p-3">
									<p className="text-muted">Materials</p>
									<p className="mt-1 font-semibold">{course.materialCount}</p>
								</div>
								<div className="rounded-lg bg-background/40 p-3">
									<p className="text-muted">Style guide</p>
									<p className="mt-1 font-semibold capitalize">
										{course.styleGuideStatus}
									</p>
								</div>
							</div>
							<div className="mt-6 flex gap-2">
								<Link
									href={`/classes/${course.id}`}
									className="rounded-lg p-2 hover:bg-glass"
								>
									<FileUp aria-label="Upload material" size={18} />
								</Link>
								<Link
									href={`/classes/${course.id}`}
									className="rounded-lg p-2 hover:bg-glass"
								>
									<Pencil aria-label="Edit class" size={18} />
								</Link>
								<Link
									href={`/classes/${course.id}`}
									className="rounded-lg p-2 hover:bg-glass"
								>
									<Archive aria-label="Archive class" size={18} />
								</Link>
							</div>
						</GlassPanel>
					))}
				</div>
			</div>
		</AppShell>
	);
}
