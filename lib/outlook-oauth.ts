import fs from "node:fs";
import path from "node:path";
import * as oauth from "openid-client";
import type { MailAccount } from "@/lib/config";

type OutlookOAuthConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
};

type StoredToken = {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

const OUTLOOK_COOKIE_STATE = "outlook_oauth_state";
const OUTLOOK_COOKIE_CODE_VERIFIER = "outlook_oauth_code_verifier";
const OUTLOOK_COOKIE_EMAIL = "outlook_oauth_email";
const OUTLOOK_COOKIE_TOKEN_PREFIX = "outlook_oauth_refresh_";

function getTokenStorePath() {
  return path.join(process.cwd(), ".data", "outlook-oauth-tokens.json");
}

function ensureTokenStoreDir() {
  fs.mkdirSync(path.dirname(getTokenStorePath()), { recursive: true });
}

function readTokenStore(): StoredToken[] {
  const storePath = getTokenStorePath();
  if (!fs.existsSync(storePath)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8")) as StoredToken[];
  } catch {
    return [];
  }
}

function writeTokenStore(tokens: StoredToken[]) {
  ensureTokenStoreDir();
  fs.writeFileSync(getTokenStorePath(), JSON.stringify(tokens, null, 2));
}

function upsertStoredToken(token: StoredToken) {
  const tokens = readTokenStore().filter((item) => item.email !== token.email);
  tokens.push(token);
  writeTokenStore(tokens);
}

function getStoredToken(email: string) {
  return readTokenStore().find((item) => item.email === email.trim().toLowerCase()) ?? null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getRefreshTokenCookieName(email: string) {
  return `${OUTLOOK_COOKIE_TOKEN_PREFIX}${Buffer.from(normalizeEmail(email)).toString("base64url")}`;
}

export function getOutlookRefreshTokenCookieName(email: string) {
  return getRefreshTokenCookieName(email);
}

export function getOutlookRefreshTokenFromCookies(email: string, cookieStore?: CookieReader) {
  if (!cookieStore) {
    return null;
  }

  return cookieStore.get(getRefreshTokenCookieName(email))?.value ?? null;
}

export function getOutlookOAuthConfig(): OutlookOAuthConfig {
  return {
    enabled: process.env.OUTLOOK_OAUTH_ENABLED?.trim().toLowerCase() === "true",
    clientId: process.env.OUTLOOK_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET?.trim() ?? "",
    tenantId: process.env.OUTLOOK_TENANT_ID?.trim() || "common",
    redirectUri:
      process.env.OUTLOOK_REDIRECT_URI?.trim() || "http://localhost:3000/api/outlook/callback"
  };
}

function requireOutlookOAuthConfig() {
  const config = getOutlookOAuthConfig();

  if (!config.enabled) {
    throw new Error("Outlook OAuth 未启用，请先配置 OUTLOOK_OAUTH_ENABLED=true");
  }

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("Outlook OAuth 缺少必要环境变量");
  }

  return config;
}

async function getOAuthClient() {
  const config = requireOutlookOAuthConfig();
  const issuer = new URL(`https://login.microsoftonline.com/${config.tenantId}/v2.0`);

  return oauth.discovery(issuer, config.clientId, config.clientSecret);
}

export async function buildOutlookAuthorizationUrl(email: string) {
  const config = requireOutlookOAuthConfig();
  const client = await getOAuthClient();
  const codeVerifier = oauth.randomPKCECodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.randomState();

  const authorizationUrl = oauth.buildAuthorizationUrl(client, {
    redirect_uri: config.redirectUri,
    scope: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "https://outlook.office.com/IMAP.AccessAsUser.All"
    ].join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    login_hint: email
  });

  return {
    authorizationUrl,
    state,
    codeVerifier,
    email
  };
}

export async function finishOutlookAuthorization(
  callbackUrl: URL,
  expectedState: string,
  codeVerifier: string,
  email: string
) {
  const client = await getOAuthClient();
  const tokens = await oauth.authorizationCodeGrant(client, callbackUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState
  });

  if (!email || !tokens.access_token || !tokens.refresh_token) {
    throw new Error("Outlook 授权成功，但没有拿到完整令牌");
  }

  const expiresAt = Date.now() + Math.max((tokens.expires_in ?? 3600) - 60, 60) * 1000;

  upsertStoredToken({
    email: normalizeEmail(email),
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    scope: tokens.scope
  });

  return {
    email: normalizeEmail(email),
    refreshToken: tokens.refresh_token,
    expiresAt
  };
}

export async function getOutlookAccessToken(account: MailAccount, cookieStore?: CookieReader) {
  const refreshTokenFromCookie = getOutlookRefreshTokenFromCookies(account.user, cookieStore);
  const storedToken =
    getStoredToken(account.user) ??
    (refreshTokenFromCookie
      ? {
          email: normalizeEmail(account.user),
          accessToken: "",
          refreshToken: refreshTokenFromCookie,
          expiresAt: 0
        }
      : null);

  if (!storedToken) {
    throw new Error(
      `Outlook 邮箱尚未授权，请先访问 /api/outlook/connect?email=${encodeURIComponent(account.user)}`
    );
  }

  if (storedToken.expiresAt > Date.now()) {
    return storedToken.accessToken;
  }

  const client = await getOAuthClient();
  const refreshed = await oauth.refreshTokenGrant(client, storedToken.refreshToken);

  if (!refreshed.access_token) {
    throw new Error("Outlook token 刷新失败");
  }

  const nextToken: StoredToken = {
    email: normalizeEmail(account.user),
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? storedToken.refreshToken,
    expiresAt: Date.now() + Math.max((refreshed.expires_in ?? 3600) - 60, 60) * 1000,
    scope: refreshed.scope ?? storedToken.scope
  };

  upsertStoredToken(nextToken);
  return nextToken.accessToken;
}

export function getOutlookTokenStatus(email: string, cookieStore?: CookieReader) {
  const refreshTokenFromCookie = getOutlookRefreshTokenFromCookies(email, cookieStore);
  if (refreshTokenFromCookie) {
    return { connected: true };
  }

  const token = getStoredToken(email);
  if (!token) {
    return { connected: false };
  }

  return {
    connected: true,
    expiresAt: token.expiresAt
  };
}

export {
  OUTLOOK_COOKIE_CODE_VERIFIER,
  OUTLOOK_COOKIE_EMAIL,
  OUTLOOK_COOKIE_STATE
};
