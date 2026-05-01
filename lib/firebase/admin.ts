import fs from "node:fs";
import {
	applicationDefault,
	cert,
	getApps,
	initializeApp,
	type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";

const serviceAccountSchema = z.object({
	project_id: z.string(),
	client_email: z.string(),
	private_key: z.string(),
});

function readServiceAccount(): ServiceAccount | null {
	const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;

	if (!keyPath || !fs.existsSync(keyPath)) {
		return null;
	}

	const parsed = serviceAccountSchema.parse(JSON.parse(fs.readFileSync(keyPath, "utf8")));

	return {
		projectId: parsed.project_id,
		clientEmail: parsed.client_email,
		privateKey: parsed.private_key,
	};
}

const serviceAccount = readServiceAccount();

export const adminApp =
	getApps().length > 0
		? getApps()[0]
		: initializeApp({
				credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
				projectId: process.env.GOOGLE_CLOUD_PROJECT,
				storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
			});

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export { FieldValue, Timestamp };
