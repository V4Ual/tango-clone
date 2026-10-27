import { NextResponse } from "next/server";
import { SESSION_COOKIE_CONFIG } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out successfully" });
  response.cookies.set(SESSION_COOKIE_CONFIG.name, "", {
    ...SESSION_COOKIE_CONFIG.options,
    maxAge: 0,
  });
  return response;
}
