import { NextRequest, NextResponse } from "next/server";
import { fetchCodes, fetchCodesForAccounts, formatUnknownError } from "@/lib/mail";
import {
  getAppConfig,
  getMailAccounts,
  getMailAccountById,
  getPhoneAliases,
  resolveAccountFromEmail,
  getVisibleSources,
  resolveAccountFromPhone,
  resolveAccountsFromPhone
} from "@/lib/config";
import { getOutlookTokenStatus } from "@/lib/outlook-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const accessPassword = request.headers.get("x-access-password");
    const { appAccessPassword, lookbackMinutes, requireAccessPassword } = getAppConfig();
    const mailboxEmail = request.nextUrl.searchParams.get("email");
    const phone = request.nextUrl.searchParams.get("phone");
    const accountId = request.nextUrl.searchParams.get("account");

    if (requireAccessPassword && (!accessPassword || accessPassword !== appAccessPassword)) {
      return NextResponse.json(
        {
          ok: false,
          message: "访问口令无效"
        },
        { status: 401 }
      );
    }

    const fallbackPhone =
      phone ??
      (mailboxEmail && /^\d+$/.test(mailboxEmail.trim()) ? mailboxEmail.trim() : null);

    const resolvedAccountsByPhone = resolveAccountsFromPhone(fallbackPhone ?? undefined);
    const resolvedByPhone = resolvedAccountsByPhone[0] ?? resolveAccountFromPhone(fallbackPhone ?? undefined);
    const resolvedByEmail = !fallbackPhone ? resolveAccountFromEmail(mailboxEmail ?? undefined) : null;

    let account = resolvedByPhone?.account ?? resolvedByEmail ?? undefined;
    if (!account) {
      try {
        account = getMailAccountById(accountId ?? undefined);
      } catch {
        account = getMailAccounts()[0];
      }
    }

    if (
      mailboxEmail &&
      !fallbackPhone &&
      mailboxEmail.toLowerCase() !== account.user.toLowerCase()
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "当前只支持查询已配置的自有邮箱"
        },
        { status: 400 }
      );
    }

    const sourceId = request.nextUrl.searchParams.get("source");
    const result = resolvedAccountsByPhone.length > 1
      ? await fetchCodesForAccounts(
          sourceId ?? undefined,
          resolvedAccountsByPhone.map((item) => item.account.id),
          request.cookies
        )
      : await fetchCodes(sourceId ?? undefined, account.id, request.cookies);

    return NextResponse.json({
      ok: true,
      items: result.items,
      sources: getVisibleSources().map(({ id, label }) => ({ id, label })),
      lookbackMinutes,
      mailbox:
        resolvedAccountsByPhone.length > 1
          ? resolvedAccountsByPhone.map((item) => item.account.user).join(" / ")
          : account.user,
      accounts: getMailAccounts().map(({ id, label, user, kind }) => ({
        id,
        label,
        user,
        kind,
        ...(kind === "outlook" ? getOutlookTokenStatus(user, request.cookies) : {})
      })),
      phoneAliases: getPhoneAliases(),
      resolvedPhone: resolvedByPhone?.alias.phone ?? null,
      requireAccessPassword,
      scanned: result.scanned,
      matched: result.matched,
      warnings: result.warnings
    });
  } catch (error) {
    const message = formatUnknownError(error);

    console.error("[mail-code-panel] /api/codes failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: `邮箱读取失败: ${message}`
      },
      { status: 500 }
    );
  }
}
