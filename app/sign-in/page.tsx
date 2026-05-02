import { SignInForm } from "@/components/auth/sign-in-form";
import { PublicNav } from "@/components/layout/site-nav";
import { ExamArtifactPreview } from "@/components/marketing/exam-artifact-preview";
import { GlassPanel } from "@/components/ui/surface";

export default function SignInPage() {
	return (
		<div className="min-h-screen bg-background">
			<PublicNav />
			<main className="relative overflow-hidden">
				<div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(1_0_0_/_0.035)_1px,transparent_1px),linear-gradient(180deg,oklch(1_0_0_/_0.025)_1px,transparent_1px)] bg-[size:72px_72px]" />
				<div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_440px]">
					<div className="space-y-8">
						<div className="max-w-2xl space-y-5">
							<p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
								Return to the atelier
							</p>
							<h1 className="text-5xl font-semibold leading-[1] tracking-normal text-foreground md:text-6xl">
								Your library is a shelf of paper-ready exams
							</h1>
							<p className="text-lg leading-8 text-muted">
								Resume generations, download polished PDFs, review answer keys, and
								grade attempts without losing the formal exam surface.
							</p>
						</div>
						<ExamArtifactPreview compact className="hidden max-w-lg lg:block" />
					</div>
					<div className="space-y-4">
						<GlassPanel className="p-6">
							<SignInForm />
							<a
								href="/forgot-password"
								className="mt-5 block text-sm text-secondary"
							>
								Forgot password?
							</a>
						</GlassPanel>
						<p className="text-center text-sm text-muted">
							New to ExamPull?{" "}
							<a href="/sign-up" className="text-secondary">
								Create a free account
							</a>
						</p>
					</div>
				</div>
			</main>
		</div>
	);
}
