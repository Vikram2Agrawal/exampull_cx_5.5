"use client";

import { FirebaseError } from "firebase/app";
import {
	GoogleAuthProvider,
	signInWithEmailAndPassword,
	signInWithPopup,
	signOut,
} from "firebase/auth";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { firebaseAuth } from "@/lib/firebase/client";

function authMessage(error: unknown) {
	if (error instanceof FirebaseError) {
		if (error.code === "auth/invalid-credential") {
			return "The email or password is not correct.";
		}

		if (error.code === "auth/popup-closed-by-user") {
			return "The Google sign-in window was closed.";
		}
	}

	return "Sign-in failed. Try again or use another method.";
}

async function createSession(idToken: string) {
	const response = await fetch("/api/auth/session", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ idToken, mode: "signin" }),
	});

	if (!response.ok) {
		await signOut(firebaseAuth);
		const payload = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new Error(payload?.error ?? "ExamPull could not create a session.");
	}
}

export function SignInForm() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function finishWithToken(idToken: string) {
		await createSession(idToken);
		router.push("/dashboard");
		router.refresh();
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
			await finishWithToken(await credential.user.getIdToken(true));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : authMessage(cause));
		} finally {
			setIsSubmitting(false);
		}
	}

	async function onGoogle() {
		setIsSubmitting(true);
		setError(null);

		try {
			const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
			await finishWithToken(await credential.user.getIdToken(true));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : authMessage(cause));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form className="space-y-5" onSubmit={onSubmit}>
			<div>
				<label className="text-sm font-medium" htmlFor="email">
					Email
				</label>
				<input
					id="email"
					type="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					required
					className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
				/>
			</div>
			<div>
				<label className="text-sm font-medium" htmlFor="password">
					Password
				</label>
				<input
					id="password"
					type="password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					required
					className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
				/>
			</div>
			{error ? (
				<p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>
			) : null}
			<Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
				<LogIn aria-hidden="true" size={18} />
				{isSubmitting ? "Signing in" : "Sign in"}
			</Button>
			<Button type="button" className="w-full" onClick={onGoogle} disabled={isSubmitting}>
				Continue with Google
			</Button>
		</form>
	);
}
