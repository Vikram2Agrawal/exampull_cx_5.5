import { BookOpen, GraduationCap, Sparkles } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { MaterialUploader } from "@/components/class/material-uploader";
import { AppShell } from "@/components/layout/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserClass, listClassMaterials } from "@/lib/classes/data";

export default async function ClassDetailPage({
	params,
}: {
	params: Promise<{ classId: string }>;
}) {
	const { classId } = await params;
	const user = await getCurrentUser();

	if (!user) {
		redirect("/sign-in");
	}

	const [course, materials] = await Promise.all([
		getUserClass(user.uid, classId),
		listClassMaterials(user.uid, classId),
	]);

	if (!course) {
		notFound();
	}

	return (
		<AppShell active="classes">
			<div className="space-y-8">
				<div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
					<SectionHeader title={course.name}>
						<p>
							{course.institution ?? "Independent study"} - {course.educationLevel}
							/100 difficulty - {course.materialCount} materials
						</p>
					</SectionHeader>
					<ButtonLink href="/exams/new" variant="primary">
						Create exam
					</ButtonLink>
				</div>
				<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
					<GlassPanel className="p-6">
						<div className="flex items-center gap-3">
							<BookOpen aria-hidden="true" className="text-secondary" size={22} />
							<h2 className="text-xl font-semibold">Materials</h2>
						</div>
						<div className="mt-5">
							<MaterialUploader classId={course.id} materials={materials} />
						</div>
					</GlassPanel>
					<div className="space-y-4">
						<GlassPanel className="p-5">
							<div className="flex items-center gap-3">
								<GraduationCap
									aria-hidden="true"
									className="text-secondary"
									size={22}
								/>
								<h2 className="font-semibold">Class profile</h2>
							</div>
							<p className="mt-4 text-sm text-muted">
								{course.description ??
									"Use the materials list and focus fields to define what ExamPull should treat as in-scope."}
							</p>
						</GlassPanel>
						<GlassPanel className="p-5">
							<div className="flex items-center gap-3">
								<Sparkles aria-hidden="true" className="text-premium" size={22} />
								<h2 className="font-semibold">Instructor style guide</h2>
							</div>
							<p className="mt-2 text-sm capitalize text-muted">
								{course.styleGuideStatus.replaceAll("_", " ")}
							</p>
							{course.styleGuide ? (
								<p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted">
									{course.styleGuide}
								</p>
							) : (
								<p className="mt-4 text-sm text-muted">
									Upload a past exam as a style reference to mirror instructor
									layout, wording, and rigor.
								</p>
							)}
						</GlassPanel>
					</div>
				</div>
			</div>
		</AppShell>
	);
}
