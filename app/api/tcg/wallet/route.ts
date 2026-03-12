import { NextResponse } from "next/server";

export async function GET() {
  // Wallet reads happen client-side via Firestore SDK (requires auth).
  // This route exists as a fallback / health check.
  return NextResponse.json({
    message: "Use the client-side Firestore SDK to read wallets. See lib/firestore.ts → getWallet()",
  });
}
