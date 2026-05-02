import { SignUpForm } from "@/components/auth/sign-up-form";
import { PublicNav } from "@/components/layout/site-nav";
import { ExamArtifactPreview } from "@/components/marketing/exam-artifact-preview";
import { GlassPanel } from "@/components/ui/surface";

export default function SignUpPage() {
	return (
		<div className="min-h-screen bg-background">
			<PublicNav />
			<main className="relative overflow-hidden">
				<div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(1_0_0_/_0.035)_1px,transparent_1px),linear-gradient(180deg,oklch(1_0_0_/_0.025)_1px,transparent_1px)] bg-[size:72px_72px]" />
				<div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_460px]">
					<div className="space-y-8">
						<div className="max-w-2xl space-y-5">
							<p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
								Create your account
							</p>
							<h1 className="text-4xl font-semibold leading-[1] tracking-normal text-foreground md:text-6xl">
								Verify once. Start building exams.
							</h1>
							<p className="text-lg leading-8 text-muted">
								Phone verification happens before the account is created. That keeps
								free credits protected and prevents half-created accounts if the
								code step fails.
							</p>
						</div>
						<ExamArtifactPreview compact className="hidden max-w-lg lg:block" />
					</div>
					<div className="space-y-4">
						<GlassPanel className="p-6">
							<SignUpForm />
						</GlassPanel>
						<p className="text-center text-sm text-muted">
							Already have exams here?{" "}
							<a href="/sign-in" className="text-secondary">
								Sign in
							</a>
						</p>
					</div>
				</div>
			</main>
		</div>
	);
}
