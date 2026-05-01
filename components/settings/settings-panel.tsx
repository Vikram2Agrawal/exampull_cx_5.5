"use client";

import { Bell, Copy, CreditCard, Download, Link2, Moon, Network, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function SettingsPanel({
	displayName,
	email,
	referralCode,
	referralUrl,
}: {
	displayName: string;
	email: string | null;
	referralCode: string;
	referralUrl: string;
}) {
	const router = useRouter();
	const [name, setName] = useState(displayName);
	const [emailNotifications, setEmailNotifications] = useState(true);
	const [productNotifications, setProductNotifications] = useState(true);
	const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
	const [status, setStatus] = useState("");
	const [isPending, startTransition] = useTransition();

	function saveProfile() {
		startTransition(async () => {
			try {
				const response = await fetch("/api/settings/profile", {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						displayName: name,
						notificationEmail: emailNotifications,
						notificationProduct: productNotifications,
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
		<div className="grid gap-4 lg:grid-cols-2">
			<section className="rounded-lg border border-glass-border bg-glass p-6">
				<Link2 aria-hidden="true" className="text-secondary" size={22} />
				<h2 className="mt-4 text-xl font-semibold">Profile and linked accounts</h2>
				<p className="mt-2 text-sm text-muted">{email ?? "Email address unavailable"}</p>
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
			<section className="rounded-lg border border-glass-border bg-glass p-6">
				<Bell aria-hidden="true" className="text-secondary" size={22} />
				<h2 className="mt-4 text-xl font-semibold">Notification preferences</h2>
				<label className="mt-5 flex items-center gap-3 text-sm">
					<input
						type="checkbox"
						checked={emailNotifications}
						onChange={(event) => setEmailNotifications(event.target.checked)}
					/>
					Email receipts, exports, and account events
				</label>
				<label className="mt-3 flex items-center gap-3 text-sm">
					<input
						type="checkbox"
						checked={productNotifications}
						onChange={(event) => setProductNotifications(event.target.checked)}
					/>
					In-product exam and grading updates
				</label>
			</section>
			<section className="rounded-lg border border-glass-border bg-glass p-6">
				<Moon aria-hidden="true" className="text-secondary" size={22} />
				<h2 className="mt-4 text-xl font-semibold">Appearance</h2>
				<select
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
			<section className="rounded-lg border border-glass-border bg-glass p-6">
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
			<section className="rounded-lg border border-glass-border bg-glass p-6">
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
			<section className="rounded-lg border border-glass-border bg-glass p-6">
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
			<section className="rounded-lg border border-error/40 bg-error/10 p-6">
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
