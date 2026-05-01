"use server";

import type { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createExamForUser, createExamRequestSchema } from "@/lib/exams/create";

const createExamSchema = createExamRequestSchema;

export async function createExamAction(rawInput: z.infer<typeof createExamSchema>) {
	const user = await getCurrentUser();

	if (!user) {
		throw new Error("Sign in required.");
	}

	const input = createExamSchema.parse(rawInput);
	return createExamForUser({ user, input });
}
