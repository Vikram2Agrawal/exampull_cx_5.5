"use client";

import { createContext, type ReactNode, useContext } from "react";

const AdminCsrfContext = createContext("");

export function AdminCsrfProvider({ children, token }: { children: ReactNode; token: string }) {
	return <AdminCsrfContext.Provider value={token}>{children}</AdminCsrfContext.Provider>;
}

export function useAdminCsrfToken() {
	const token = useContext(AdminCsrfContext);

	if (!token) {
		throw new Error("Admin CSRF token is unavailable.");
	}

	return token;
}
