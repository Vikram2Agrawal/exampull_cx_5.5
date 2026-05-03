"use client";

import { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, getRedirectResult, linkWithRedirect, signOut } from "firebase/auth";
import {
	Bell,
	Copy,
	CreditCard,
	Download,
	KeyRound,
	Link2,
	Moon,
	Network,
	Shield,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { LinkedAuthProvider } from "@/lib/auth/providers";
import { firebaseAuth } from "@/lib/firebase/client";
import {
	type NotificationEventType,
	type NotificationPreferences,
	notificationEventDefinitions,
} from "@/lib/user/notification-preferences";

async function refreshLinkedSession(idToken: string) {
	const response = await fetch("/api/auth/session", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ idToken, mode: "signin" }),
	});
	const body = (await response.json().catch(() => ({}))) as { error?: string };

	if (!response.ok) {
		await signOut(firebaseAuth);
		throw new Error(body.error ?? "ExamPull could not refresh linked account data.");
	}
}

function googleLinkMessage(error: unknown) {
	if (error instanceof FirebaseError) {
		if (error.code === "auth/provider-already-linked") {
			return "Google sign-in is already linked.";
		}

		if (error.code === "auth/credential-already-in-use") {
			return "That Google account is already linked to another ExamPull account. Sign in with that account first.";
		}

		if (error.code === "auth/requires-recent-login") {
			return "Sign out and sign back in, then link Google from Settings.";
		}

		if (error.code === "auth/popup-closed-by-user") {
			return "The Google window closed before linking finished.";
		}

		if (error.code === "auth/operation-not-allowed") {
			return "Google sign-in is not enabled on this deployment. This is a configuration issue.";
		}
	}

	return error instanceof Error ? error.message : "Google linking failed.";
}

export function SettingsPanel({
	displayName,
	email,
	linkedAuthProviders,
	referralCode,
	referralUrl,
	initialTheme,
	initialNotificationPreferences,
}: {
	displayName: string;
	email: string | null;
	linkedAuthProviders: LinkedAuthProvider[];
	referralCode: string;
	referralUrl: string;
	initialTheme: "system" | "light" | "dark";
	initialNotificationPreferences: NotificationPreferences;
}) {
	const router = useRouter();
	const [name, setName] = useState(displayName);
	const [notificationPreferences, setNotificationPreferences] = useState(
		initialNotificationPreferences,
	);
	const [theme, setTheme] = useState<"system" | "light" | "dark">(initialTheme);
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();
	const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
	const hasGoogle = linkedAuthProviders.some((provider) => provider.type === "google");

	useEffect(() => {
		if (window.sessionStorage.getItem("exampull:link-google") !== "pending") {
			return;
		}

		let cancelled = false;

		startTransition(async () => {
			try {
				const result = await getRedirectResult(firebaseAuth);
				const user = result?.user ?? firebaseAuth.currentUser;

				if (!user) {
					throw new Error("Sign in again before linking Google.");
				}

				const googleLinked =
					result?.providerId === "google.com" ||
					user.providerData.some((provider) => provider.providerId === "google.com");

				if (!googleLinked) {
					throw new Error("Google linking was not completed.");
				}

				await refreshLinkedSession(await user.getIdToken(true));
				window.sessionStorage.removeItem("exampull:link-google");
				if (!cancelled) {
					setStatus("Google sign-in linked.");
					router.refresh();
				}
			} catch (error) {
				window.sessionStorage.removeItem("exampull:link-google");
				if (!cancelled) {
					setStatus(googleLinkMessage(error));
				}
			}
		});

		return () => {
			cancelled = true;
		};
	}, [router]);

	async function linkGoogle() {
		setStatus("Opening Google sign-in...");
		setIsLinkingGoogle(true);

		try {
			const user = firebaseAuth.currentUser;
			if (!user) {
				throw new Error("Sign in again before linking Google.");
			}

			window.sessionStorage.setItem("exampull:link-google", "pending");
			await linkWithRedirect(user, new GoogleAuthProvider());
		} catch (error) {
			window.sessionStorage.removeItem("exampull:link-google");
			setStatus(googleLinkMessage(error));
			setIsLinkingGoogle(false);
		}
	}

	function saveProfile() {
		startTransition(async () => {
			try {
				const response = await fetch("/api/settings/profile", {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						displayName: name,
						notificationEmail: true,
						notificationProduct: true,
						notificationPreferences,
						theme,
					}),
				});
				const body = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(body.error ?? "Settings update failed.");
				}

				setStatus("Settings saved.");
				router.refresh();
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Settings update failed.");
			}
		});
	}

	function setNotificationPreference(
		eventType: NotificationEventType,
		channel: "email" | "sms",
		checked: boolean,
	) {
		setNotificationPreferences((current) => ({
			...current,
			[eventType]: {
				...current[eventType],
				[channel]: checked,
				inApp: true,
			},
		}));
	}

	function deleteAccount() {
		startTransition(async () => {
			try {
				const response = await fetch("/api/settings/delete", { method: "POST" });
				const body = (await response.json().catch(() => ({}))) as { error?: string };

				if (!response.ok) {
					throw new Error(body.error ?? "Account deletion failed.");
				}

				window.location.href = "/";
			} catch (error) {
				setStatus(error instanceof Error ? error.message : "Account deletion failed.");
			}
		});
	}

	async function copyReferralLink() {
		await navigator.clipboard?.writeText(referralUrl);
		setStatus("Referral link copied.");
	}

	return (
		<div className="grid min-w-0 gap-4 lg:grid-cols-2">
			<section className="min-w-0 rounded-lg border border-glass-border bg-glass p-6">
				<Link2 aria-hidden="true" className="text-secondary" size={22} />
				<h2 className="mt-4 text-xl font-semibold">Profile and linked accounts</h2>
				<p className="mt-2 text-sm text-muted">{email ?? "Email address unavailable"}</p>
				<div className="mt-5 space-y-2">
					<p className="text-sm font-medium">Linked sign-in sources</p>
					<div className="space-y-2">
						{linkedAuthProviders.length > 0 ? (
							linkedAuthProviders.map((provider) => (
								<div
									key={`${provider.type}:${provider.identifier}`}
									className="flex items-center justify-between rounded-lg border border-glass-border bg-background/50 px-3 py-2 text-sm"
								>
									<span className="font-medium">{provider.label}</span>
									<span className="break-all text-right text-muted">
										{provider.identifier}
									</span>
								</div>
							))
						) : (
							<p className="rounded-lg border border-glass-border bg-background/50 px-3 py-2 text-sm text-muted">
								Sign in again to sync linked sources.
							</p>
						)}
					</div>
					<Button
						type="button"
						className="mt-3"
						disabled={isPending || isLinkingGoogle || hasGoogle}
						onClick={() => void linkGoogle()}
					>
						<KeyRound aria-hidden="true" size={16} />
						{hasGoogle
							? "Google linked"
							: isLinkingGoogle
								? "Opening Google"
								: "Link Google"}
					</Button>
				</div>
				<label className="mt-5 block text-sm font-medium">
					Display name
					<input
						className="mt-2 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3 outline-none focus:ring-2 focus:ring-brand"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</label>
				<Button type="button" className="mt-5" disabled={isPending} onClick={saveProfile}>
					Save profile
				</Button>
			</section>
			<section className="min-w-0 rounded-lg border border-glass-border bg-glass p-6">
				<Bell aria-hidden="true" className="text-secondary" size={22} />
				<h2 className="mt-4 text-xl font-semibold">Notification preferences</h2>
				<div className="mt-5 space-y-2">
					{notificationEventDefinitions.map((event) => (
						<div
							key={event.key}
							className="rounded-lg border border-glass-border bg-background/45 p-3 text-sm"
						>
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<p className="font-medium">{event.label}</p>
									<p className="text-xs leading-5 text-muted">
										{event.description}
									</p>
								</div>
								<div className="grid grid-cols-3 gap-2 text-xs text-muted sm:w-56">
									<label className="flex min-h-9 items-center justify-center gap-2 rounded-lg bg-glass px-2">
										<input
											aria-label={`${event.label} email`}
											type="checkbox"
											checked={notificationPreferences[event.key].email}
											onChange={(changeEvent) =>
												setNotificationPreference(
													event.key,
													"email",
													changeEvent.target.checked,
												)
											}
										/>
										Email
									</label>
									<label className="flex min-h-9 items-center justify-center gap-2 rounded-lg bg-glass px-2">
										<input
											aria-label={`${event.label} SMS`}
											type="checkbox"
											checked={notificationPreferences[event.key].sms}
											onChange={(changeEvent) =>
												setNotificationPreference(
													event.key,
													"sms",
													changeEvent.target.checked,
												)
											}
										/>
										SMS
									</label>
									<label className="flex min-h-9 items-center justify-center gap-2 rounded-lg bg-glass px-2">
										<input
											aria-label={`${event.label} in-app`}
											type="checkbox"
											checked
											disabled
											readOnly
										/>
										In-app
									</label>
								</div>
							</div>
						</div>
					))}
				</div>
				<Button type="button" className="mt-5" disabled={isPending} onClick={saveProfile}>
					Save notifications
				</Button>
			</section>
			<section className="min-w-0 rounded-lg border border-glass-border bg-glass p-6">
				<Moon aria-hidden="true" className="text-secondary" size={22} />
				<h2 className="mt-4 text-xl font-semibold">Appearance</h2>
				<select
					aria-label="Theme"
					className="mt-5 h-11 w-full rounded-lg border border-glass-border bg-background/70 px-3"
					value={theme}
					onChange={(event) =>
						setTheme(event.target.value as "system" | "light" | "dark")
					}
				>
					<option value="system">System</option>
					<option value="light">Light</option>
					<option value="dark">Dark</option>
				</select>
				<Button type="button" className="mt-5" disabled={isPending} onClick={saveProfile}>
					Save appearance
				</Button>
			</section>
			<section className="min-w-0 rounded-lg border border-glass-border bg-glass p-6">
				<Network aria-hidden="true" className="text-secondary" size={22} />
				<h2 className="mt-4 text-xl font-semibold">Refer friends</h2>
				<p className="mt-2 text-sm leading-6 text-muted">
					Earn Scholar months when friends generate exams and Guru months when they
					upgrade.
				</p>
				<div className="mt-5 rounded-lg border border-glass-border bg-background/50 p-3">
					<p className="text-xs uppercase text-muted">Referral code</p>
					<p className="mt-1 font-mono text-sm">{referralCode}</p>
					<p className="mt-3 break-all text-sm text-muted">{referralUrl}</p>
				</div>
				<Button
					type="button"
					className="mt-5"
					disabled={isPending}
					onClick={copyReferralLink}
				>
					<Copy aria-hidden="true" size={16} />
					Copy link
				</Button>
			</section>
			<section className="min-w-0 rounded-lg border border-glass-border bg-glass p-6">
				<CreditCard aria-hidden="true" className="text-secondary" size={22} />
				<h2 className="mt-4 text-xl font-semibold">Subscription and billing</h2>
				<p className="mt-2 text-sm leading-6 text-muted">
					Manage invoices, payment method, and cancellation from the billing portal.
				</p>
				<a
					href="/billing"
					className="mt-5 inline-flex h-11 items-center justify-center rounded-lg border border-glass-border bg-glass px-4 text-sm font-medium"
				>
					Open billing
				</a>
			</section>
			<section className="min-w-0 rounded-lg border border-glass-border bg-glass p-6">
				<Download aria-hidden="true" className="text-secondary" size={22} />
				<h2 className="mt-4 text-xl font-semibold">Data export</h2>
				<p className="mt-2 text-sm leading-6 text-muted">
					Export account, exam, class, attempt, material, and notification records as
					JSON.
				</p>
				<a
					href="/api/settings/export"
					className="mt-5 inline-flex h-11 items-center justify-center rounded-lg border border-glass-border bg-glass px-4 text-sm font-medium"
				>
					Download export
				</a>
			</section>
			<section className="min-w-0 rounded-lg border border-error/40 bg-error/10 p-6">
				<Shield aria-hidden="true" className="text-error" size={22} />
				<h2 className="mt-4 text-xl font-semibold">Account deletion</h2>
				<p className="mt-2 text-sm leading-6 text-muted">
					Delete the account, stored files, generated exams, classes, attempts, and
					Firebase auth identity.
				</p>
				<Button
					type="button"
					variant="danger"
					className="mt-5"
					disabled={isPending}
					onClick={deleteAccount}
				>
					Delete account
				</Button>
			</section>
			{status ? <p className="text-sm text-muted lg:col-span-2">{status}</p> : null}
		</div>
	);
}
