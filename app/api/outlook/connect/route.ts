import { NextRequest, NextResponse } from "next/server";
import { getMailAccounts } from "@/lib/config";
import {
  buildOutlookAuthorizationUrl,
  OUTLOOK_COOKIE_CODE_VERIFIER,
  OUTLOOK_COOKIE_EMAIL,
  OUTLOOK_COOKIE_STATE
} from "@/lib/outlook-oauth";

export async function GET(request: NextRequest) {
  try {
    const requestedEmail = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
    const outlookAccounts = getMailAccounts().filter((item) => item.kind === "outlook");
    const account =
      (requestedEmail
        ? outlookAccounts.find((item) => item.user.trim().toLowerCase() === requestedEmail)
        : null) ?? outlookAccounts[0];

    if (!account) {
      return NextResponse.json(
        {
          ok: false,
          message: "未找到 Outlook 邮箱账户，请先在 MAIL_ACCOUNTS_JSON 中配置"
        },
        { status: 400 }
      );
    }

    const { authorizationUrl, codeVerifier, email, state } = await buildOutlookAuthorizationUrl(
      account.user
    );

    const response = NextResponse.redirect(authorizationUrl);
    const secure = request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
    response.cookies.set(OUTLOOK_COOKIE_STATE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/"
    });
    response.cookies.set(OUTLOOK_COOKIE_CODE_VERIFIER, codeVerifier, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/"
    });
    response.cookies.set(OUTLOOK_COOKIE_EMAIL, email, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/"
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "发起 Outlook 授权失败"
      },
      { status: 500 }
    );
  }
}
