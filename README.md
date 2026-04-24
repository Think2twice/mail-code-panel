# Mail Code Panel

English / [简体中文](./README_CN.md)

A read-only mailbox verification code panel for your own authorized email accounts. It can scan recent emails, extract likely verification codes, and map phone numbers to specific mailbox accounts.

> This project is intended only for mailboxes you own and explicitly authorize. Do not use it to access other people's accounts or bypass any third-party platform restrictions.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Think2twice/mail-code-panel&env=MAIL_ACCOUNTS_JSON,MAIL_LOOKBACK_MINUTES,MAIL_FETCH_LIMIT,MAIL_CONNECT_TIMEOUT_MS,MAIL_SOCKET_TIMEOUT_MS,REQUIRE_ACCESS_PASSWORD,APP_ACCESS_PASSWORD&envDescription=Configure%20your%20authorized%20mailboxes%20and%20access%20password.&project-name=mail-code-panel&repository-name=mail-code-panel)

## Features

- Multiple mailbox accounts: Gmail, QQ Mail, Outlook, or any compatible IMAP mailbox.
- Automatic email routing: enter an email address and the app matches the configured mailbox.
- Phone alias mapping: enter a phone number and query the mailbox account mapped to it.
- Outlook OAuth: supports Outlook.com IMAP through Microsoft OAuth and XOAUTH2.
- Access password: protect public deployments with a separate web access password.
- Code extraction: prioritizes 4 to 8 digit codes near verification-code context.
- Vercel friendly: designed for fork-and-deploy personal hosting.

## How It Works

The browser submits the phone number or email to `/api/codes`. The server resolves the mailbox from `MAIL_ACCOUNTS_JSON` and `PHONE_ALIAS_JSON`, reads recent emails through IMAP, extracts verification codes from subject/body content, then returns the result to the page.

Outlook is different from Gmail and QQ Mail. Outlook.com usually blocks basic IMAP password login, so the app uses Microsoft OAuth. After deployment, enter the Outlook email and click the Outlook authorization button once.

## Quick Deploy

1. Fork this repository.
2. Click the `Deploy with Vercel` button above, or import your fork in Vercel.
3. Add the required Environment Variables in Vercel.
4. Deploy.
5. If you use Outlook, add your production callback URL in Azure:

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

## Environment Variables

Recommended multi-account mode:

```env
MAIL_ACCOUNTS_JSON=[{"id":"qq-main","label":"QQ Mail","kind":"qq","host":"imap.qq.com","port":993,"secure":true,"user":"your-qq@qq.com","password":"your-qq-auth-code","mailbox":"INBOX"}]
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

## Add Gmail

Create a Gmail app password first. Gmail usually requires 2-Step Verification before app passwords are available.

Add this item to `MAIL_ACCOUNTS_JSON`:

```json
{
  "id": "gmail-main",
  "label": "Gmail",
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
  "label": "QQ Mail",
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
  "label": "Outlook",
  "kind": "outlook",
  "host": "outlook.office365.com",
  "port": 993,
  "secure": true,
  "user": "your@outlook.com",
  "password": "oauth-placeholder",
  "mailbox": "INBOX"
}
```

After deployment, open the app, enter the Outlook email, and click `Connect Outlook`.

## Phone Alias Mapping

Use `PHONE_ALIAS_JSON` to map a phone number to one or more mailbox accounts.

```env
PHONE_ALIAS_JSON=[{"phone":"13800138000","accountId":"qq-main","label":"Main phone - QQ"}]
```

With this config, entering `13800138000` queries `qq-main`.

## Webhook Roadmap

Webhook support is not built in yet. A future version can add a webhook endpoint such as `/api/webhooks/code-found` to notify another service when a code is found.

Recommended design:

1. Add `WEBHOOK_URL` and `WEBHOOK_SECRET` environment variables.
2. After extracting a code, POST a JSON payload to `WEBHOOK_URL`.
3. Sign the payload with `WEBHOOK_SECRET`.
4. Add retry and timeout handling.
5. Keep webhook delivery optional so normal code querying still works without it.

## Donations

Donation links can be added here later.

Common options:

- GitHub Sponsors
- Buy Me a Coffee
- Afdian
- WeChat Pay or Alipay QR code image

## Ownership and License

This project is authored and maintained by `Think2twice` and is released under the MIT License.

Open source does not erase authorship. People may fork, modify, and deploy the project under the license terms, but the repository history, license notice, and attribution remain tied to the original author unless someone intentionally removes them in their own fork.

## Vercel Environment Notes

Vercel environment variables are separate from `.env.local`.

- Local development reads `.env.local`.
- Vercel production reads variables from Vercel Project Settings.
- After editing Vercel Environment Variables, redeploy the project so the new values are used.
- Never put real passwords, auth codes, app passwords, or OAuth secrets in GitHub.

For JSON variables in Vercel, one-line JSON is easiest to paste:

```env
MAIL_ACCOUNTS_JSON=[{"id":"qq-main","label":"QQ Mail","kind":"qq","host":"imap.qq.com","port":993,"secure":true,"user":"your-qq@qq.com","password":"your-qq-auth-code","mailbox":"INBOX"}]
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
