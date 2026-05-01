import { SignUpForm } from "@/components/auth/sign-up-form";
import { PublicNav } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

export default function VerifyPhonePage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
				<SectionHeader title="Enter the verification code">
					<p>
						When the code is confirmed, ExamPull creates the account and grants monthly
						credits.
					</p>
				</SectionHeader>
				<GlassPanel className="mt-8 p-6">
					<SignUpForm />
				</GlassPanel>
			</main>
		</div>
	);
}
