import { expect, type Locator, type Page, test } from "@playwright/test";
import { envValue, seedExam, signInAsTestUser } from "./test-auth";

test.skip(
	Boolean(process.env.TEST_BASE_URL) && process.env.TEST_SESSION_API_ENABLED !== "true",
	"Local accessibility E2E uses authenticated test-session helpers.",
);

async function tabTo(page: Page, target: Locator, maxTabs = 80) {
	for (let index = 0; index < maxTabs; index += 1) {
		if (
			await target
				.evaluate((element) => element === document.activeElement)
				.catch(() => false)
		) {
			return;
		}

		await page.keyboard.press("Tab");
	}

	throw new Error("Target was not reachable with Tab.");
}

async function signInAsAdminAgent(page: Page) {
	const password = envValue("ADMIN_AGENT_PASSWORD");
	expect(password, "ADMIN_AGENT_PASSWORD must be set for admin E2E").toBeTruthy();
	const response = await page.context().request.post("/api/admin/auth/agent", {
		data: { password },
	});
	expect(response.status()).toBe(200);
}

test("keyboard user can traverse signup details without pointer input", async ({ page }) => {
	await page.goto("/sign-up");

	const nameInput = page.getByLabel("Name");
	await tabTo(page, nameInput);
	await page.keyboard.type("Keyboard Ada");
	await tabTo(page, page.getByLabel("Email"));
	await page.keyboard.type(`keyboard-signup-${Date.now()}@exampull.test`);
	await tabTo(page, page.getByLabel("Password"));
	await page.keyboard.type("KeyboardPass123!");
	await tabTo(page, page.getByLabel("Phone number"));
	await page.keyboard.type("+15555550123");

	const sendCodeButton = page.getByRole("button", { name: "Send verification code" });
	await tabTo(page, sendCodeButton);
	await expect(sendCodeButton).toBeFocused();
	await tabTo(page, page.getByRole("button", { name: "Continue with Google" }));
	await expect(page.getByRole("button", { name: "Continue with Google" })).toBeFocused();
});

test("keyboard user can queue a wizard exam and screen readers receive form status", async ({
	page,
}) => {
	const title = `Keyboard wizard exam ${Date.now()}`;
	await signInAsTestUser(page, `keyboard-wizard-${Date.now()}@exampull.test`, {
		tier: "guru",
		credits: 500,
	});

	await page.goto("/exams/new");
	await expect(page.getByRole("status").filter({ hasText: "0 topics ready" })).toBeVisible();
	await tabTo(page, page.getByLabel("Exam title"));
	await page.keyboard.type(title);
	await tabTo(page, page.getByRole("textbox", { name: "Topics" }));
	await page.keyboard.insertText("Keyboard navigation\nFocus management");
	await expect(page.getByRole("status").filter({ hasText: "2 topics ready" })).toBeVisible();
	const generateButton = page.getByRole("button", { name: "Generate", exact: true });
	await tabTo(page, generateButton);
	await page.keyboard.press("Enter");

	await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
	await expect(page.getByRole("region", { name: "Generation tracker" })).toBeVisible();
});

test("keyboard user can operate library bulk actions and modal focus trap", async ({ page }) => {
	await signInAsTestUser(page, `keyboard-library-${Date.now()}@exampull.test`);
	await seedExam(page, "Keyboard modal library exam");

	await page.goto("/exams");
	const searchInput = page.getByLabel("Search exams");
	await tabTo(page, searchInput);
	await page.keyboard.type("Keyboard modal");
	await tabTo(page, page.getByLabel("Select Keyboard modal library exam"));
	await page.keyboard.press("Space");

	const deleteButton = page.getByRole("button", { name: "Delete" });
	await tabTo(page, deleteButton);
	await page.keyboard.press("Enter");

	const dialog = page.getByRole("alertdialog", { name: "Delete selected exams?" });
	await expect(dialog).toBeVisible();
	const cancelButton = page.getByRole("button", { name: "Cancel" });
	const confirmButton = page.getByRole("button", { name: "Confirm delete" });
	await expect(cancelButton).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(confirmButton).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(cancelButton).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(deleteButton).toBeFocused();

	await page.keyboard.press("Enter");
	await expect(dialog).toBeVisible();
	await page.keyboard.press("Tab");
	await expect(confirmButton).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("status").filter({ hasText: "Library updated." })).toBeVisible();
	await expect(page.getByLabel("Select Keyboard modal library exam")).toHaveCount(0);
});

test("keyboard user can navigate admin sections and focus admin search", async ({ page }) => {
	await signInAsAdminAgent(page);
	await page.goto("/admin/users");

	const configurationLink = page.getByRole("link", { name: "Configuration" });
	await tabTo(page, configurationLink);
	await page.keyboard.press("Enter");
	await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();
	const adminSearch = page.getByLabel("Admin search");
	await tabTo(page, adminSearch);
	await page.keyboard.type("keyboard audit");
	await expect(adminSearch).toHaveValue("keyboard audit");
});
