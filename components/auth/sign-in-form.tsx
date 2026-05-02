"use client";

import { FirebaseError } from "firebase/app";
import {
	GoogleAuthProvider,
	linkWithCredential,
	type OAuthCredential,
	signInWithEmailAndPassword,
	signInWithPopup,
	signOut,
} from "firebase/auth";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
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

		if (error.code === "auth/account-exists-with-different-credential") {
			return "We found an ExamPull account with this email. Sign in with the existing method to link Google.";
		}

		if (error.code === "auth/credential-already-in-use") {
			return "That sign-in source is already linked to another ExamPull account.";
		}
	}

	if (error instanceof Error) {
		return error.message;
	}

	return "Sign-in failed. Try again or use another method.";
}

function emailFromFirebaseError(error: FirebaseError) {
	const email = error.customData?.email;

	return typeof email === "string" ? email : "";
}

async function createSession(idToken: string, previewId: string) {
	const response = await fetch("/api/auth/session", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ idToken, mode: "signin", previewId }),
	});

	if (!response.ok) {
		await signOut(firebaseAuth);
		const payload = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new Error(payload?.error ?? "ExamPull could not create a session.");
	}

	return (await response.json()) as { claimedExamId?: string };
}

export function SignInForm() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [previewId, setPreviewId] = useState("");
	const [pendingGoogleCredential, setPendingGoogleCredential] = useState<OAuthCredential | null>(
		null,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const preview = params.get("preview") ?? window.localStorage.getItem("exampull_preview_id");
		if (preview) {
			const cleanPreview = preview.trim().slice(0, 120);
			setPreviewId(cleanPreview);
			window.localStorage.setItem("exampull_preview_id", cleanPreview);
		}
	}, []);

	async function finishWithToken(idToken: string) {
		const session = await createSession(idToken, previewId);
		if (session.claimedExamId) {
			window.localStorage.removeItem("exampull_preview_id");
		}
		router.push(session.claimedExamId ? `/exams/${session.claimedExamId}` : "/dashboard");
		router.refresh();
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
			if (pendingGoogleCredential) {
				await linkWithCredential(credential.user, pendingGoogleCredential);
				setPendingGoogleCredential(null);
			}
			await finishWithToken(await credential.user.getIdToken(true));
		} catch (cause) {
			setError(authMessage(cause));
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
			if (
				cause instanceof FirebaseError &&
				cause.code === "auth/account-exists-with-different-credential"
			) {
				const credential = GoogleAuthProvider.credentialFromError(cause);
				const existingEmail = emailFromFirebaseError(cause);

				if (credential && existingEmail) {
					setEmail(existingEmail);
					setPendingGoogleCredential(credential);
					setError(
						`We found an ExamPull account for ${existingEmail}. Enter its password to link Google to the same account.`,
					);
					return;
				}
			}

			setError(authMessage(cause));
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
				{isSubmitting
					? "Signing in"
					: pendingGoogleCredential
						? "Sign in and link Google"
						: "Sign in"}
			</Button>
			<Button type="button" className="w-full" onClick={onGoogle} disabled={isSubmitting}>
				Continue with Google
			</Button>
		</form>
	);
}
