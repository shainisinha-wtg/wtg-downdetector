import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionAccount } from "./session";

export const ADMIN_COOKIE_NAME = "wtg-admin-session";

/**
 * Server-side authentication check
 * Returns the authenticated admin account or redirects to login
 */
export async function requireAdmin(): Promise<{
  id: string;
  username: string;
  displayName: string;
}> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect("/admin/login");
  }

  const account = await getSessionAccount(sessionToken);

  if (!account) {
    redirect("/admin/login");
  }

  return account;
}

/**
 * Get current admin account without redirecting
 * Returns null if not authenticated
 */
export async function getCurrentAdmin(): Promise<{
  id: string;
  username: string;
  displayName: string;
} | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  return getSessionAccount(sessionToken);
}
