import { existsSync, readFileSync } from "node:fs";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import {
	type CollectionReference,
	type DocumentData,
	type DocumentReference,
	getFirestore,
} from "firebase-admin/firestore";
import { z } from "zod";
import { envValue } from "./test-auth";

const serviceAccountSchema = z.object({
	project_id: z.string(),
	client_email: z.string(),
	private_key: z.string(),
});

const userSubcollections = [
	"abuseReports",
	"attempts",
	"classes",
	"communications",
	"creditLedger",
	"examUploads",
	"exams",
	"notifications",
	"refunds",
] as const;

function serviceAccount(): ServiceAccount | null {
	const keyPath =
		envValue("FIREBASE_SERVICE_ACCOUNT_KEY_PATH") ?? envValue("GOOGLE_APPLICATION_CREDENTIALS");

	if (!keyPath || !existsSync(keyPath)) {
		return null;
	}

	const parsed = serviceAccountSchema.parse(JSON.parse(readFileSync(keyPath, "utf8")));

	return {
		projectId: parsed.project_id,
		clientEmail: parsed.client_email,
		privateKey: parsed.private_key,
	};
}

function adminApp() {
	if (getApps().length > 0) {
		return getApps()[0];
	}

	const account = serviceAccount();
	const projectId =
		envValue("GOOGLE_CLOUD_PROJECT") ?? envValue("NEXT_PUBLIC_FIREBASE_PROJECT_ID");

	return initializeApp({
		credential: account ? cert(account) : undefined,
		projectId,
		storageBucket: envValue("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
	});
}

function isTestAuthUser(user: UserRecord) {
	return (
		user.email?.endsWith("@exampull.test") === true ||
		user.displayName === "Phone Smoke" ||
		user.displayName === "ExamPull E2E"
	);
}

async function deleteCollection(collection: CollectionReference<DocumentData>) {
	const snapshot = await collection.limit(100).get();
	if (snapshot.empty) {
		return;
	}

	const db = getFirestore(adminApp());
	const batch = db.batch();
	for (const doc of snapshot.docs) {
		batch.delete(doc.ref);
	}
	await batch.commit();

	if (snapshot.size === 100) {
		await deleteCollection(collection);
	}
}

async function deleteUserTree(userRef: DocumentReference<DocumentData>) {
	for (const subcollection of userSubcollections) {
		await deleteCollection(userRef.collection(subcollection));
	}

	await userRef.delete();
}

async function deleteStaleFirestoreTestUsersByPhone(phoneNumber: string) {
	const db = getFirestore(adminApp());
	const snapshot = await db.collection("users").where("phoneNumber", "==", phoneNumber).get();

	for (const doc of snapshot.docs) {
		if (doc.get("isTestAccount") === true) {
			await deleteUserTree(doc.ref);
		}
	}
}

export async function cleanupFirebaseTestPhoneAccount(phoneNumber: string) {
	const app = adminApp();
	const auth = getAuth(app);
	const db = getFirestore(app);
	let user: UserRecord;

	try {
		user = await auth.getUserByPhoneNumber(phoneNumber);
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "auth/user-not-found"
		) {
			await deleteStaleFirestoreTestUsersByPhone(phoneNumber);
			return;
		}

		throw error;
	}

	const userRef = db.collection("users").doc(user.uid);
	const snapshot = await userRef.get();
	const isTestFirestoreUser = snapshot.exists && snapshot.get("isTestAccount") === true;

	if (!isTestAuthUser(user) && !isTestFirestoreUser) {
		throw new Error(
			`Refusing to delete Firebase auth user ${user.uid}; it is not tagged as test data.`,
		);
	}

	await deleteUserTree(userRef);
	await auth.deleteUser(user.uid);
}
