import { execFileSync } from "node:child_process";

const minimumNodeMajor = 22;
const minimumPnpmMajor = 10;

function fail(message) {
	console.error(`Preflight failed: ${message}`);
	process.exitCode = 1;
}

function parseMajor(version) {
	const clean = version.trim().replace(/^v/, "");
	const major = Number.parseInt(clean.split(".")[0] ?? "", 10);
	return Number.isFinite(major) ? major : null;
}

const nodeMajor = parseMajor(process.version);
if (nodeMajor === null || nodeMajor < minimumNodeMajor) {
	fail(`Node ${process.version} is active. Run \`nvm use 22\` before project commands.`);
}

let pnpmVersion = "";
try {
	pnpmVersion = execFileSync("pnpm", ["--version"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
} catch (error) {
	const stderr =
		error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
	fail(`pnpm is not runnable from this shell. ${stderr.trim()}`.trim());
}

const pnpmMajor = parseMajor(pnpmVersion);
if (pnpmMajor === null || pnpmMajor < minimumPnpmMajor) {
	fail(`pnpm ${pnpmVersion || "unknown"} is active. Use corepack with pnpm 10.`);
}

if (process.exitCode) {
	process.exit();
}

console.log(`Preflight passed: Node ${process.version}, pnpm ${pnpmVersion}.`);
