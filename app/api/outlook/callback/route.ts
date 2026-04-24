import { NextRequest, NextResponse } from "next/server";
import {
  finishOutlookAuthorization,
  getOutlookRefreshTokenCookieName,
  OUTLOOK_COOKIE_CODE_VERIFIER,
  OUTLOOK_COOKIE_EMAIL,
  OUTLOOK_COOKIE_STATE
} from "@/lib/outlook-oauth";

export async function GET(request: NextRequest) {
  const state = request.cookies.get(OUTLOOK_COOKIE_STATE)?.value ?? "";
  const codeVerifier = request.cookies.get(OUTLOOK_COOKIE_CODE_VERIFIER)?.value ?? "";
  const email = request.cookies.get(OUTLOOK_COOKIE_EMAIL)?.value ?? "";

  try {
    if (!state || !codeVerifier || !email) {
      throw new Error("Outlook 授权上下文已丢失，请重新发起连接");
    }

    const token = await finishOutlookAuthorization(new URL(request.url), state, codeVerifier, email);

    const response = NextResponse.redirect(
      new URL(`/?identifier=${encodeURIComponent(email)}&outlook=connected`, request.url)
    );
    const secure = request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";

    response.cookies.set(getOutlookRefreshTokenCookieName(token.email), token.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });

    response.cookies.set(OUTLOOK_COOKIE_STATE, "", { maxAge: 0, path: "/" });
    response.cookies.set(OUTLOOK_COOKIE_CODE_VERIFIER, "", { maxAge: 0, path: "/" });
    response.cookies.set(OUTLOOK_COOKIE_EMAIL, "", { maxAge: 0, path: "/" });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Outlook 授权失败";
    const response = NextResponse.redirect(
      new URL(`/?outlook_error=${encodeURIComponent(message)}`, request.url)
    );

    response.cookies.set(OUTLOOK_COOKIE_STATE, "", { maxAge: 0, path: "/" });
    response.cookies.set(OUTLOOK_COOKIE_CODE_VERIFIER, "", { maxAge: 0, path: "/" });
    response.cookies.set(OUTLOOK_COOKIE_EMAIL, "", { maxAge: 0, path: "/" });

    return response;
  }
}
