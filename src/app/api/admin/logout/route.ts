import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeSession } from "@/modules/auth/session";
import { ADMIN_COOKIE_NAME } from "@/modules/auth/require-admin";

export async function POST() {
  const response = NextResponse.json({ success: true });

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

    if (token) {
      await revokeSession(token);
    }
  } catch {
    console.error("Session revocation failed during logout");
  }

  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
