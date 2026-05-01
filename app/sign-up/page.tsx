import { SignUpForm } from "@/components/auth/sign-up-form";
import { PublicNav } from "@/components/layout/site-nav";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

export default function SignUpPage() {
	return (
		<div className="min-h-screen">
			<PublicNav />
			<main className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_420px]">
				<SectionHeader title="Create your account after phone verification">
					<p>
						ExamPull verifies phone ownership before creating the durable account. That
						protects free monthly credits without creating an unverified-account edge
						state.
					</p>
				</SectionHeader>
				<GlassPanel className="p-6">
					<SignUpForm />
				</GlassPanel>
			</main>
		</div>
	);
}
