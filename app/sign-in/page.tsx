import { SignInForm } from "@/components/auth/sign-in-form";
import { PublicNav } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

export default function SignInPage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_420px]">
				<SectionHeader title="Welcome back">
					<p>
						Sign in to your library, active generations, classes, billing, and grading
						history.
					</p>
				</SectionHeader>
				<GlassPanel className="p-6">
					<SignInForm />
					<a href="/forgot-password" className="mt-5 block text-sm text-secondary">
						Forgot password?
					</a>
				</GlassPanel>
			</main>
		</div>
	);
}
