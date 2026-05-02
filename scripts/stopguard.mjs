import { execSync } from "node:child_process";
import fs from "node:fs";

const requiredFiles = ["TRACKER.md", "TEST_FLOWS.md", "BLOCKED.md"];
const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));
const allowDirty = process.env.STOPGUARD_ALLOW_DIRTY === "true";

const failures = [];

if (missingFiles.length > 0) {
	failures.push(`Missing required control docs: ${missingFiles.join(", ")}`);
}

if (fs.existsSync("TEST_FLOWS.md")) {
	const flows = fs.readFileSync("TEST_FLOWS.md", "utf8");
	const openCritical = flows.split("\n").filter((line) => /^- \[( |!)\] P[0-2]-/.test(line));

	if (openCritical.length > 0) {
		failures.push(
			`Open P0/P1/P2 test flows remain:\n${openCritical.map((line) => `  ${line}`).join("\n")}`,
		);
	}
}

if (fs.existsSync("TRACKER.md")) {
	const tracker = fs.readFileSync("TRACKER.md", "utf8");
	const openItems = tracker.split("\n").filter((line) => /^- \[ \]/.test(line));

	if (openItems.length > 0) {
		failures.push(
			`Open tracker items remain:\n${openItems.map((line) => `  ${line}`).join("\n")}`,
		);
	}
}

if (!allowDirty) {
	const status = execSync("git status --short", { encoding: "utf8" }).trim();

	if (status) {
		failures.push(`Uncommitted work remains:\n${status}`);
	}

	const branch = execSync("git status --short --branch", { encoding: "utf8" })
		.split("\n")[0]
		?.trim();

	if (branch?.includes("[ahead ")) {
		failures.push(`Local commits have not been pushed:\n${branch}`);
	}

	if (branch?.includes("[behind ")) {
		failures.push(`Local branch is behind its upstream:\n${branch}`);
	}
}

if (failures.length > 0) {
	console.error(`Stopguard blocked completion.\n\n${failures.join("\n\n")}`);
	process.exit(1);
}

console.log("Stopguard passed.");
