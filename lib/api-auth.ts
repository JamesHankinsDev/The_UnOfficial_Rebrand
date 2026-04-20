import type { NextRequest } from "next/server";
import { getAdminAuth } from "./firebase-admin";

/**
 * Verifies a Firebase ID token from the `Authorization: Bearer` header and
 * returns the caller's uid. Throws `Error("unauthorized")` on any failure —
 * callers should catch and return 401.
 */
export async function verifyCallerUid(request: NextRequest): Promise<string> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new Error("unauthorized");
  }
  const token = header.slice("Bearer ".length).trim();
  const decoded = await getAdminAuth().verifyIdToken(token);
  return decoded.uid;
}
