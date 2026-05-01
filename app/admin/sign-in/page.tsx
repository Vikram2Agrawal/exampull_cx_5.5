import { KeyRound, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel, SectionHeader } from "@/components/ui/surface";

export default function AdminSignInPage() {
	return (
		<main className="min-h-screen bg-white px-4 py-16 text-slate-950 sm:px-6">
			<div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_420px]">
				<SectionHeader title="Admin sign in">
					<p className="text-slate-600">
						Passkey and SMS are for the human operator. Agent auth is API-only and not
						shown here.
					</p>
				</SectionHeader>
				<GlassPanel className="border-slate-200 bg-white p-6 text-slate-950 shadow-xl">
					<Button type="button" variant="primary" className="w-full">
						<KeyRound aria-hidden="true" size={18} />
						Sign in with passkey
					</Button>
					<Button type="button" className="mt-3 w-full">
						<Smartphone aria-hidden="true" size={18} />
						Send login code via SMS
					</Button>
					<p className="mt-5 text-sm leading-6 text-slate-600">
						Unauthenticated admin routes return 404. Sessions are separate from user app
						sessions.
					</p>
				</GlassPanel>
			</div>
		</main>
	);
}
