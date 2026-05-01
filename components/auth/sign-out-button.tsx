"use client";

import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { firebaseAuth } from "@/lib/firebase/client";

export function SignOutButton() {
	const router = useRouter();
	const [isSigningOut, setIsSigningOut] = useState(false);

	async function onClick() {
		setIsSigningOut(true);
		await fetch("/api/auth/session", { method: "DELETE" });
		await signOut(firebaseAuth).catch(() => undefined);
		router.push("/");
		router.refresh();
	}

	return (
		<Button type="button" variant="ghost" onClick={onClick} disabled={isSigningOut}>
			<LogOut aria-hidden="true" size={16} />
			{isSigningOut ? "Signing out" : "Sign out"}
		</Button>
	);
}
