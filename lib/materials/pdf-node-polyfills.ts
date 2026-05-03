let installed = false;

type PdfCanvasGlobals = typeof globalThis & {
	DOMMatrix?: unknown;
	ImageData?: unknown;
	Path2D?: unknown;
};

export async function installPdfNodePolyfills() {
	if (installed) {
		return;
	}

	const canvas = await import("@napi-rs/canvas");
	const globals = globalThis as PdfCanvasGlobals;

	if (!globals.DOMMatrix) {
		Reflect.set(globalThis, "DOMMatrix", canvas.DOMMatrix);
	}
	if (!globals.ImageData) {
		Reflect.set(globalThis, "ImageData", canvas.ImageData);
	}
	if (!globals.Path2D) {
		Reflect.set(globalThis, "Path2D", canvas.Path2D);
	}
	installed = true;
}
