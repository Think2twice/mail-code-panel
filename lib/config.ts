import fs from "node:fs";
import path from "node:path";

type SourceRule = {
  id: string;
  label: string;
  senders?: string[];
  subjectKeywords?: string[];
  bodyKeywords?: string[];
};

type MailAccount = {
  id: string;
  label: string;
  kind: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  mailbox: string;
};

type PhoneAlias = {
  phone: string;
  accountId: string;
  label?: string;
};

function readRequired(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }

  return value;
}

function readOptional(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function readMultilineEnvFromFile(name: string) {
  const candidates = [".env.local", ".env"];

  for (const filename of candidates) {
    const fullPath = path.join(process.cwd(), filename);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/);
    const startIndex = lines.findIndex((line) => line.startsWith(`${name}=`));

    if (startIndex === -1) {
      continue;
    }

    const firstValue = lines[startIndex].slice(name.length + 1).trim();
    if (!firstValue) {
      return "";
    }

    if (!["[", "{"].includes(firstValue[0])) {
      return firstValue;
    }

    const collected: string[] = [firstValue];
    let depth = 0;

    for (let i = 0; i < collected[0].length; i += 1) {
      const char = collected[0][i];
      if (char === "[" || char === "{") {
        depth += 1;
      } else if (char === "]" || char === "}") {
        depth -= 1;
      }
    }

    for (let lineIndex = startIndex + 1; lineIndex < lines.length && depth > 0; lineIndex += 1) {
      const line = lines[lineIndex];
      collected.push(line);

      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === "[" || char === "{") {
          depth += 1;
        } else if (char === "]" || char === "}") {
          depth -= 1;
        }
      }
    }

    return collected.join("\n").trim();
  }

  return "";
}

function readJsonEnv(name: string) {
  const raw = readOptional(name);

  if (!raw) {
    return "";
  }

  if (raw === "[" || raw === "{") {
    return readMultilineEnvFromFile(name);
  }

  return raw;
}

function parsePositiveInteger(input: string | undefined, fallback: number) {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function parseBoolean(input: string | undefined, fallback: boolean) {
  if (typeof input !== "string") {
    return fallback;
  }

  const normalized = input.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function getVisibleSources(): SourceRule[] {
  const raw = readJsonEnv("SOURCE_RULES_JSON");

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SourceRule[];

    if (!Array.isArray(parsed)) {
      throw new Error("SOURCE_RULES_JSON 必须是数组");
    }

    parsed.forEach((item) => {
      if (!item.id || !item.label) {
        throw new Error("每条来源规则都必须有 id 和 label");
      }
    });

    return parsed;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `SOURCE_RULES_JSON 解析失败: ${error.message}`
        : "SOURCE_RULES_JSON 解析失败"
    );
  }
}

function parseAccountsJson(raw: string): MailAccount[] {
  const parsed = JSON.parse(raw) as Array<Partial<MailAccount>>;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("MAIL_ACCOUNTS_JSON 必须是非空数组");
  }

  return parsed.map((item, index) => {
    if (!item.id || !item.label || !item.host || !item.user || !item.password) {
      throw new Error(`MAIL_ACCOUNTS_JSON 第 ${index + 1} 项缺少必要字段`);
    }

    return {
      id: item.id,
      label: item.label,
      kind: item.kind ?? "imap",
      host: item.host,
      port: Number(item.port) || 993,
      secure: typeof item.secure === "boolean" ? item.secure : true,
      user: item.user,
      password: item.password,
      mailbox: item.mailbox ?? "INBOX"
    };
  });
}

function normalizePhone(input: string) {
  return input.replace(/\D/g, "");
}

export function getMailAccounts(): MailAccount[] {
  const raw = readJsonEnv("MAIL_ACCOUNTS_JSON");

  if (raw) {
    try {
      return parseAccountsJson(raw);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `MAIL_ACCOUNTS_JSON 解析失败: ${error.message}`
          : "MAIL_ACCOUNTS_JSON 解析失败"
      );
    }
  }

  return [
    {
      id: "primary",
      label: "主邮箱",
      kind: "imap",
      host: readRequired("MAIL_HOST"),
      port: parsePositiveInteger(process.env.MAIL_PORT, 993),
      secure: parseBoolean(process.env.MAIL_SECURE, true),
      user: readRequired("MAIL_USER"),
      password: readRequired("MAIL_PASSWORD"),
      mailbox: process.env.MAILBOX ?? "INBOX"
    }
  ];
}

export function getMailAccountById(accountId?: string) {
  const accounts = getMailAccounts();

  if (!accountId) {
    return accounts[0];
  }

  const account = accounts.find((item) => item.id === accountId);
  if (!account) {
    throw new Error(`未找到邮箱账户: ${accountId}`);
  }

  return account;
}

export function resolveAccountFromEmail(email?: string) {
  if (!email) {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return getMailAccounts().find((item) => item.user.trim().toLowerCase() === normalized) ?? null;
}

export function getPhoneAliases(): PhoneAlias[] {
  const raw = readJsonEnv("PHONE_ALIAS_JSON");

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<PhoneAlias>>;

    if (!Array.isArray(parsed)) {
      throw new Error("PHONE_ALIAS_JSON 必须是数组");
    }

    return parsed.map((item, index) => {
      if (!item.phone || !item.accountId) {
        throw new Error(`PHONE_ALIAS_JSON 第 ${index + 1} 项缺少 phone 或 accountId`);
      }

      return {
        phone: normalizePhone(item.phone),
        accountId: item.accountId,
        label: item.label ?? item.phone
      };
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `PHONE_ALIAS_JSON 解析失败: ${error.message}`
        : "PHONE_ALIAS_JSON 解析失败"
    );
  }
}

export function resolveAccountFromPhone(phone?: string) {
  if (!phone) {
    return null;
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return null;
  }

  const alias = getPhoneAliases().find((item) => item.phone === normalized);
  if (!alias) {
    return null;
  }

  return {
    alias,
    account: getMailAccountById(alias.accountId)
  };
}

export function resolveAccountsFromPhone(phone?: string) {
  if (!phone) {
    return [];
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return [];
  }

  return getPhoneAliases()
    .filter((item) => item.phone === normalized)
    .map((alias) => ({
      alias,
      account: getMailAccountById(alias.accountId)
    }));
}

export function getAppConfig() {
  return {
    appAccessPassword: readOptional("APP_ACCESS_PASSWORD"),
    requireAccessPassword: parseBoolean(process.env.REQUIRE_ACCESS_PASSWORD, false),
    lookbackMinutes: parsePositiveInteger(process.env.MAIL_LOOKBACK_MINUTES, 30),
    fetchLimit: parsePositiveInteger(process.env.MAIL_FETCH_LIMIT, 30),
    connectTimeoutMs: parsePositiveInteger(process.env.MAIL_CONNECT_TIMEOUT_MS, 12000),
    socketTimeoutMs: parsePositiveInteger(process.env.MAIL_SOCKET_TIMEOUT_MS, 15000)
  };
}

export type { MailAccount, PhoneAlias, SourceRule };
