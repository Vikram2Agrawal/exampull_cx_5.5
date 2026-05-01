import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("security rules", () => {
	it("allows user subtree reads only to the owning Firebase uid", () => {
		const rules = readFileSync("firestore.rules", "utf8");

		expect(rules).toContain("request.auth.uid == userId");
		expect(rules).toContain("match /users/{userId}");
		expect(rules).toContain("allow read: if owns(userId);");
		expect(rules).toContain("allow write: if false;");
		expect(rules).not.toContain("allow read, write: if true;");
	});

	it("keeps private uploaded files behind server routes only", () => {
		const rules = readFileSync("storage.rules", "utf8");

		expect(rules).toContain("match /users/{userId}/{allPaths=**}");
		expect(rules).toContain("allow read, write: if false;");
		expect(rules).toContain("match /anonymous/{anonymousUid}/{allPaths=**}");
		expect(rules).not.toContain("allow read: if request.auth");
	});
});
