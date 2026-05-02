import { describe, expect, it } from "vitest";
import { accountDeletionSubcollections } from "@/lib/user/data";

describe("account deletion coverage", () => {
	it("includes ad hoc exam uploads in account deletion cleanup", () => {
		expect(accountDeletionSubcollections()).toEqual([
			"classes",
			"exams",
			"examUploads",
			"notifications",
			"referrals",
		]);
	});
});
