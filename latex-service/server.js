import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import express from "express";

const execFileAsync = promisify(execFile);
const app = express();

app.use(express.json({ limit: "10mb" }));

app.get("/health", (_request, response) => {
	response.json({ status: "ok", service: "latex-service" });
});

app.post("/compile", async (request, response) => {
	try {
		const result = await compile(request.body.latex, request.body.engine ?? "pdflatex", false);
		response.type("application/pdf").send(Buffer.from(result.pdf, "base64"));
	} catch (error) {
		response
			.status(400)
			.json({ error: error instanceof Error ? error.message : "Compile failed" });
	}
});

app.post("/compile-and-render", async (request, response) => {
	try {
		const result = await compile(request.body.latex, request.body.engine ?? "pdflatex", true);
		response.json(result);
	} catch (error) {
		response
			.status(400)
			.json({ error: error instanceof Error ? error.message : "Compile failed" });
	}
});

async function compile(latex, engine, renderPages) {
	if (typeof latex !== "string" || latex.length === 0) {
		throw new Error("latex is required");
	}

	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "exampull-"));
	const texPath = path.join(directory, "exam.tex");
	const pdfPath = path.join(directory, "exam.pdf");

	await fs.writeFile(texPath, latex, "utf8");
	await execFileAsync(
		engine,
		["-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape", texPath],
		{
			cwd: directory,
			timeout: 120000,
		},
	);

	const pdf = await fs.readFile(pdfPath);
	const pages = [];

	if (renderPages) {
		await execFileAsync(
			"pdftoppm",
			["-png", "-r", "200", pdfPath, path.join(directory, "page")],
			{
				cwd: directory,
				timeout: 120000,
			},
		);
		const files = (await fs.readdir(directory)).filter((file) => file.endsWith(".png")).sort();

		for (const file of files) {
			pages.push((await fs.readFile(path.join(directory, file))).toString("base64"));
		}
	}

	await fs.rm(directory, { recursive: true, force: true });

	return {
		pdf: pdf.toString("base64"),
		pages,
	};
}

app.listen(process.env.PORT || 8080, () => {
	console.log("latex-service listening");
});
