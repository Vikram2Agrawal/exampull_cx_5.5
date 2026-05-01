import fs from "node:fs";

const requiredFiles = ["TRACKER.md", "TEST_FLOWS.md", "BLOCKED.md"];
const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));

const failures = [];

if (missingFiles.length > 0) {
	failures.push(`Missing required control docs: ${missingFiles.join(", ")}`);
}

if (fs.existsSync("TEST_FLOWS.md")) {
	const flows = fs.readFileSync("TEST_FLOWS.md", "utf8");
	const openCritical = flows.split("\n").filter((line) => /^- \[( |!)\] P[01]-/.test(line));

	if (openCritical.length > 0) {
		failures.push(
			`Open P0/P1 test flows remain:\n${openCritical.map((line) => `  ${line}`).join("\n")}`,
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

if (failures.length > 0) {
	console.error(`Stopguard blocked completion.\n\n${failures.join("\n\n")}`);
	process.exit(1);
}

console.log("Stopguard passed.");
