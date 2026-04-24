# Mail Code Panel

一个只读邮箱验证码查询面板。它可以读取你自己授权的邮箱，自动从最近邮件中提取验证码，并支持把手机号映射到指定邮箱账户。

> 仅用于读取你自己拥有并授权的邮箱。不要用它访问、代收或绕过任何不属于你的账户。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Think2twice/mail-code-panel&env=MAIL_ACCOUNTS_JSON,MAIL_LOOKBACK_MINUTES,MAIL_FETCH_LIMIT,MAIL_CONNECT_TIMEOUT_MS,MAIL_SOCKET_TIMEOUT_MS,REQUIRE_ACCESS_PASSWORD,APP_ACCESS_PASSWORD&envDescription=Configure%20your%20authorized%20mailboxes%20and%20access%20password.&project-name=mail-code-panel&repository-name=mail-code-panel)

## Features

- 多邮箱账户：Gmail、QQ 邮箱、Outlook 或其他 IMAP 邮箱。
- 邮箱自动识别：输入邮箱地址时，自动匹配对应的邮箱账户。
- 手机号映射：输入手机号时，自动映射到你配置的邮箱账户。
- Outlook OAuth：支持 Outlook.com 的现代授权和 IMAP XOAUTH2。
- 访问口令：可开启网页访问口令，避免别人只凭手机号或邮箱查询验证码。
- 验证码提取：优先识别验证码上下文附近的 4 到 8 位数字，减少品牌名误判。
- Vercel 部署：适合作为个人私有工具部署到公网。

## How It Works

用户在网页输入手机号或邮箱后，前端会请求 `/api/codes`。后端根据 `MAIL_ACCOUNTS_JSON` 和 `PHONE_ALIAS_JSON` 判断应该查询哪个邮箱，然后通过 IMAP 读取最近邮件，再从主题和正文里提取验证码返回页面。

Outlook 与 QQ/Gmail 不一样。Outlook.com 通常不允许普通密码 IMAP 登录，所以需要先在网页里点击 `连接 Outlook 授权`，完成 Microsoft OAuth 授权后再查询。

## Quick Deploy

1. Fork this repository.
2. Click the `Deploy with Vercel` button above, or import your fork in Vercel.
3. Add the required Environment Variables in Vercel.
4. Deploy.
5. If you use Outlook, add your production callback URL to Azure:

```text
https://your-domain.vercel.app/api/outlook/callback
```

## Local Development

Install dependencies:

```bash
npm install
```

Create local env:

```bash
cp .env.example .env.local
```

Edit `.env.local`, then run:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Before deploying, run:

```bash
npm run typecheck
npm run build
```

## Required Environment Variables

For a multi-account setup, use `MAIL_ACCOUNTS_JSON`. This is the recommended mode.

```env
MAIL_ACCOUNTS_JSON=[{"id":"qq-main","label":"QQ 邮箱","kind":"qq","host":"imap.qq.com","port":993,"secure":true,"user":"your-qq@qq.com","password":"your-qq-auth-code","mailbox":"INBOX"}]
```

Recommended runtime settings:

```env
MAIL_LOOKBACK_MINUTES=30
MAIL_FETCH_LIMIT=30
MAIL_CONNECT_TIMEOUT_MS=20000
MAIL_SOCKET_TIMEOUT_MS=20000
REQUIRE_ACCESS_PASSWORD=true
APP_ACCESS_PASSWORD=change-this-password
```

If `REQUIRE_ACCESS_PASSWORD=true`, users must enter `APP_ACCESS_PASSWORD` before querying.

## Optional Single-Mailbox Mode

If you do not set `MAIL_ACCOUNTS_JSON`, the app falls back to these variables:

```env
MAIL_HOST=imap.gmail.com
MAIL_PORT=993
MAIL_SECURE=true
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAILBOX=INBOX
```

## Add Gmail

Create a Gmail app password first. Gmail usually requires 2-Step Verification before app passwords are available.

Add this item to `MAIL_ACCOUNTS_JSON`:

```json
{
  "id": "gmail-main",
  "label": "Gmail 主号",
  "kind": "gmail",
  "host": "imap.gmail.com",
  "port": 993,
  "secure": true,
  "user": "your-email@gmail.com",
  "password": "your-gmail-app-password",
  "mailbox": "INBOX"
}
```

## Add QQ Mail

In QQ Mail, enable `IMAP/SMTP` and generate an authorization code. Use that authorization code as `password`, not your QQ login password.

Add this item to `MAIL_ACCOUNTS_JSON`:

```json
{
  "id": "qq-main",
  "label": "QQ 邮箱",
  "kind": "qq",
  "host": "imap.qq.com",
  "port": 993,
  "secure": true,
  "user": "your-qq@qq.com",
  "password": "your-qq-auth-code",
  "mailbox": "INBOX"
}
```

## Add Outlook

Outlook.com uses OAuth for IMAP. You need a Microsoft Azure app registration.

1. Create an app in Azure App registrations.
2. Supported account types: `Any Microsoft Entra ID tenant and personal Microsoft accounts`.
3. Add redirect URI:

```text
http://localhost:3000/api/outlook/callback
```

For Vercel production, also add:

```text
https://your-domain.vercel.app/api/outlook/callback
```

4. Add delegated Microsoft Graph permissions:

```text
IMAP.AccessAsUser.All
openid
profile
email
User.Read
```

5. Create a client secret.
6. Set these environment variables:

```env
OUTLOOK_OAUTH_ENABLED=true
OUTLOOK_CLIENT_ID=your-azure-client-id
OUTLOOK_CLIENT_SECRET=your-azure-client-secret
OUTLOOK_TENANT_ID=common
OUTLOOK_REDIRECT_URI=https://your-domain.vercel.app/api/outlook/callback
```

7. Add the Outlook mailbox to `MAIL_ACCOUNTS_JSON`:

```json
{
  "id": "outlook-main",
  "label": "Outlook 邮箱",
  "kind": "outlook",
  "host": "outlook.office365.com",
  "port": 993,
  "secure": true,
  "user": "your@outlook.com",
  "password": "oauth-placeholder",
  "mailbox": "INBOX"
}
```

After deployment, open the app, enter the Outlook email, and click `连接 Outlook 授权`.

## Phone Alias Mapping

Use `PHONE_ALIAS_JSON` to map a phone number to one or more mailbox accounts.

```env
PHONE_ALIAS_JSON=[{"phone":"13800138000","accountId":"qq-main","label":"主手机号-QQ"}]
```

With this config, entering `13800138000` queries `qq-main`.

You can also map one phone number to multiple accounts:

```env
PHONE_ALIAS_JSON=[{"phone":"13800138000","accountId":"qq-main"},{"phone":"13800138000","accountId":"gmail-main"}]
```

## Source Rules

By default, the app scans recent emails and tries to extract likely verification codes automatically. If you want to limit which senders or subjects are allowed, set `SOURCE_RULES_JSON`.

```env
SOURCE_RULES_JSON=[{"id":"wechat","label":"微信","senders":["wechat.com"],"subjectKeywords":["验证码"],"bodyKeywords":["验证码"]}]
```

If you do not need source filtering:

```env
SOURCE_RULES_JSON=
```

## Vercel Environment Notes

Vercel environment variables are separate from `.env.local`.

- Local development reads `.env.local`.
- Vercel production reads variables from Vercel Project Settings.
- After editing Vercel Environment Variables, redeploy the project so the new values are used.
- Never put real passwords, auth codes, app passwords, or OAuth secrets in GitHub.

For JSON variables in Vercel, one-line JSON is easiest to paste:

```env
MAIL_ACCOUNTS_JSON=[{"id":"qq-main","label":"QQ 邮箱","kind":"qq","host":"imap.qq.com","port":993,"secure":true,"user":"your-qq@qq.com","password":"your-qq-auth-code","mailbox":"INBOX"}]
```

## Security

- Use application passwords or authorization codes instead of primary account passwords whenever possible.
- Keep `REQUIRE_ACCESS_PASSWORD=true` for public deployments.
- Rotate secrets if they were pasted into chat, screenshots, logs, or commits.
- Do not commit `.env.local`, `.vercel`, `.data`, `.next`, or `node_modules`.

## Scripts

```bash
npm run dev
npm run typecheck
npm run build
npm run start
```

## License

MIT
