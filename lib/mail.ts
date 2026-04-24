import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getAppConfig, getMailAccountById, getVisibleSources } from "@/lib/config";
import { getOutlookAccessToken } from "@/lib/outlook-oauth";
import {
  extractVerificationCode,
  looksLikeOtpMessage,
  makeExcerpt,
  matchesRule
} from "@/lib/extract";

type CodeItem = {
  id: string;
  accountId: string;
  accountLabel: string;
  sourceId: string;
  sourceLabel: string;
  code: string;
  subject: string;
  from: string;
  receivedAt: string;
  excerpt: string;
};

type FetchCodesResult = {
  items: CodeItem[];
  scanned: number;
  matched: number;
  warnings: string[];
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

function toIsoString(value: Date | string | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    const anyError = error as Error & { code?: string; responseText?: string };
    const parts = [error.name, anyError.code, error.message, anyError.responseText].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : "未知错误";
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "未知错误";
  }
}

export async function fetchCodes(
  sourceId?: string,
  accountId?: string,
  cookieStore?: CookieReader
): Promise<FetchCodesResult> {
  const config = getAppConfig();
  const account = getMailAccountById(accountId);
  const visibleSources = getVisibleSources();
  const rules = sourceId
    ? visibleSources.filter((rule) => rule.id === sourceId)
    : visibleSources;
  const useRuleFiltering = rules.length > 0;

  const auth =
    account.kind === "outlook"
      ? {
          user: account.user,
          accessToken: await getOutlookAccessToken(account, cookieStore)
        }
      : {
          user: account.user,
          pass: account.password
        };

  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.secure,
    connectionTimeout: config.connectTimeoutMs,
    socketTimeout: config.socketTimeoutMs,
    auth
  });

  const afterDate = new Date(Date.now() - config.lookbackMinutes * 60 * 1000);

  try {
    await client.connect();
    console.log("[mail-code-panel] IMAP connected");
    await client.mailboxOpen(account.mailbox, { readOnly: true });
    console.log("[mail-code-panel] mailbox opened:", account.mailbox);

    const sequenceNumbers = (await client.search({
      since: afterDate
    })) || [];
    console.log("[mail-code-panel] search result count:", sequenceNumbers.length);

    const pickedIds = sequenceNumbers.slice(-config.fetchLimit).reverse();
    const results: CodeItem[] = [];
    const warnings: string[] = [];
    let scanned = 0;

    for await (const message of client.fetch(pickedIds, {
      uid: true,
      envelope: true,
      source: true,
      internalDate: true
    })) {
      scanned += 1;

      try {
        const parsed = await simpleParser(message.source);
        const html =
          typeof parsed.html === "string"
            ? parsed.html
            : parsed.html
              ? parsed.html.toString()
              : "";
        const text = [parsed.subject ?? "", parsed.text ?? "", html].join("\n");
        const from = parsed.from?.text ?? message.envelope?.from?.[0]?.address ?? "未知发件人";
        const subject = parsed.subject ?? message.envelope?.subject ?? "无主题";

        if (!useRuleFiltering) {
          if (!looksLikeOtpMessage({ from, subject, text })) {
            continue;
          }

          const code = extractVerificationCode(text);
          if (!code) {
            continue;
          }

          results.push({
            id: `${message.uid}-generic-${code}`,
            accountId: account.id,
            accountLabel: account.label,
            sourceId: "generic",
            sourceLabel: "自动识别",
            code,
            from,
            subject,
            receivedAt: toIsoString(message.internalDate ?? new Date()),
            excerpt: makeExcerpt(text, code)
          });
          continue;
        }

        for (const rule of rules) {
          if (!matchesRule({ from, subject, text }, rule)) {
            continue;
          }

          const code = extractVerificationCode(text);
          if (!code) {
            continue;
          }

          results.push({
            id: `${message.uid}-${rule.id}-${code}`,
            accountId: account.id,
            accountLabel: account.label,
            sourceId: rule.id,
            sourceLabel: rule.label,
            code,
            from,
            subject,
            receivedAt: toIsoString(message.internalDate ?? new Date()),
            excerpt: makeExcerpt(text, code)
          });
          break;
        }
      } catch (error) {
        const subject = message.envelope?.subject ?? "无主题";
        warnings.push(
          `邮件解析失败: ${subject} - ${error instanceof Error ? error.message : "未知错误"}`
        );
      }
    }

    const items = dedupeByCode(results).sort((a, b) => {
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });

    return {
      items,
      scanned,
      matched: items.length,
      warnings
    };
  } catch (error) {
    console.error("[mail-code-panel] fetchCodes failed:", formatUnknownError(error), error);
    throw error;
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function fetchCodesForAccounts(
  sourceId: string | undefined,
  accountIds: string[],
  cookieStore?: CookieReader
): Promise<FetchCodesResult> {
  const results = await Promise.all(
    accountIds.map((accountId) => fetchCodes(sourceId, accountId, cookieStore))
  );

  const items = dedupeByCode(results.flatMap((result) => result.items)).sort((a, b) => {
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });

  return {
    items,
    scanned: results.reduce((sum, result) => sum + result.scanned, 0),
    matched: items.length,
    warnings: results.flatMap((result) => result.warnings)
  };
}

function dedupeByCode(items: CodeItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.sourceId}:${item.code}:${item.subject}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
