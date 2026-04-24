# Mail Code Panel

[English](./README.md) / 简体中文

一个只读邮箱验证码查询面板。它可以读取你自己授权的邮箱，自动从最近邮件中提取验证码，并支持把手机号映射到指定邮箱账户。

> 仅用于读取你自己拥有并授权的邮箱。不要用它访问、代收或绕过任何不属于你的账户。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Think2twice/mail-code-panel&env=MAIL_ACCOUNTS_JSON,MAIL_LOOKBACK_MINUTES,MAIL_FETCH_LIMIT,MAIL_CONNECT_TIMEOUT_MS,MAIL_SOCKET_TIMEOUT_MS,REQUIRE_ACCESS_PASSWORD,APP_ACCESS_PASSWORD&envDescription=Configure%20your%20authorized%20mailboxes%20and%20access%20password.&project-name=mail-code-panel&repository-name=mail-code-panel)

## 功能

- 多邮箱账户：Gmail、QQ 邮箱、Outlook 或其他兼容 IMAP 的邮箱。
- 邮箱自动识别：输入邮箱地址时，自动匹配对应的邮箱账户。
- 手机号映射：输入手机号时，自动查询映射到的邮箱账户。
- Outlook OAuth：支持 Outlook.com 的 Microsoft OAuth 和 IMAP XOAUTH2。
- 访问口令：公网部署时可以加一层网页访问口令。
- 验证码提取：优先识别验证码上下文附近的 4 到 8 位数字。
- Vercel 部署：适合作为个人工具 fork 后部署到公网。

## 工作原理

用户在网页输入手机号或邮箱后，前端会请求 `/api/codes`。后端根据 `MAIL_ACCOUNTS_JSON` 和 `PHONE_ALIAS_JSON` 判断应该查哪个邮箱，然后通过 IMAP 读取最近邮件，再从主题和正文里提取验证码返回页面。

Outlook 和 QQ/Gmail 不一样。Outlook.com 通常不允许普通密码 IMAP 登录，所以本项目使用 Microsoft OAuth。部署后，输入 Outlook 邮箱并点击 `连接 Outlook 授权`，完成授权后即可查询。

## 一键部署

1. Fork 这个仓库。
2. 点击上方 `Deploy with Vercel`，或在 Vercel 导入你的 fork。
3. 在 Vercel 里填写必要的环境变量。
4. 部署。
5. 如果使用 Outlook，在 Azure 里添加生产回调地址：

```text
https://your-domain.vercel.app/api/outlook/callback
```

## 本地开发

安装依赖：

```bash
npm install
```

创建本地环境变量：

```bash
cp .env.example .env.local
```

编辑 `.env.local` 后运行：

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

部署前建议运行：

```bash
npm run typecheck
npm run build
```

## 环境变量

推荐使用多邮箱模式：

```env
MAIL_ACCOUNTS_JSON=[{"id":"qq-main","label":"QQ 邮箱","kind":"qq","host":"imap.qq.com","port":993,"secure":true,"user":"your-qq@qq.com","password":"your-qq-auth-code","mailbox":"INBOX"}]
```

推荐运行配置：

```env
MAIL_LOOKBACK_MINUTES=30
MAIL_FETCH_LIMIT=30
MAIL_CONNECT_TIMEOUT_MS=20000
MAIL_SOCKET_TIMEOUT_MS=20000
REQUIRE_ACCESS_PASSWORD=true
APP_ACCESS_PASSWORD=change-this-password
```

如果 `REQUIRE_ACCESS_PASSWORD=true`，用户查询前必须输入 `APP_ACCESS_PASSWORD`。

## 添加 Gmail

先在 Gmail 里创建应用专用密码。Gmail 通常需要先开启两步验证。

把这一项加入 `MAIL_ACCOUNTS_JSON`：

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

## 添加 QQ 邮箱

在 QQ 邮箱里开启 `IMAP/SMTP`，并生成授权码。这里的 `password` 填 QQ 邮箱授权码，不要填 QQ 登录密码。

把这一项加入 `MAIL_ACCOUNTS_JSON`：

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

## 添加 Outlook

Outlook.com 读取 IMAP 需要 OAuth。你需要先在 Microsoft Azure 里注册应用。

1. 在 Azure App registrations 里创建应用。
2. 支持账户类型选择：`任何 Microsoft Entra ID 租户和个人 Microsoft 帐户`。
3. 添加本地回调地址：

```text
http://localhost:3000/api/outlook/callback
```

Vercel 生产环境还要添加：

```text
https://your-domain.vercel.app/api/outlook/callback
```

4. 添加 Microsoft Graph 委托权限：

```text
IMAP.AccessAsUser.All
openid
profile
email
User.Read
```

5. 创建客户端密码。
6. 设置这些环境变量：

```env
OUTLOOK_OAUTH_ENABLED=true
OUTLOOK_CLIENT_ID=your-azure-client-id
OUTLOOK_CLIENT_SECRET=your-azure-client-secret
OUTLOOK_TENANT_ID=common
OUTLOOK_REDIRECT_URI=https://your-domain.vercel.app/api/outlook/callback
```

7. 把 Outlook 邮箱加入 `MAIL_ACCOUNTS_JSON`：

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

部署后打开网页，输入 Outlook 邮箱，点击 `连接 Outlook 授权`。

## 手机号映射

使用 `PHONE_ALIAS_JSON` 把手机号映射到一个或多个邮箱账户。

```env
PHONE_ALIAS_JSON=[{"phone":"13800138000","accountId":"qq-main","label":"主手机号-QQ"}]
```

这样输入 `13800138000` 时，会查询 `qq-main`。

## Webhook 规划

当前还没有内置 Webhook。后续可以添加 `/api/webhooks/code-found` 这类接口，在找到验证码后通知其他服务。

推荐实现步骤：

1. 添加 `WEBHOOK_URL` 和 `WEBHOOK_SECRET` 环境变量。
2. 提取到验证码后，向 `WEBHOOK_URL` 发送 JSON。
3. 使用 `WEBHOOK_SECRET` 给 payload 签名。
4. 加入重试和超时处理。
5. 保持 Webhook 可选，不影响普通网页查询。

## 赞助

后面可以在这里添加赞助入口。

常见方式：

- GitHub Sponsors
- Buy Me a Coffee
- 爱发电
- 微信或支付宝收款码图片

## 署名和许可证

这个项目由 `Think2twice` 创建和维护，并使用 MIT License 开源。

开源不等于作者身份消失。别人可以在许可证允许范围内 fork、修改和部署，但仓库历史、许可证声明和署名仍然会指向原作者，除非别人在自己的 fork 里故意移除这些信息。

## Vercel 环境变量说明

Vercel 的环境变量和 `.env.local` 是分开的。

- 本地开发读取 `.env.local`。
- Vercel 生产环境读取 Vercel Project Settings 里的 Environment Variables。
- 在 Vercel 里修改环境变量后，需要重新部署，新的值才会进入线上运行版本。
- 不要把真实密码、授权码、应用专用密码或 OAuth secret 提交到 GitHub。

JSON 变量在 Vercel 里建议写成一行：

```env
MAIL_ACCOUNTS_JSON=[{"id":"qq-main","label":"QQ 邮箱","kind":"qq","host":"imap.qq.com","port":993,"secure":true,"user":"your-qq@qq.com","password":"your-qq-auth-code","mailbox":"INBOX"}]
```

## 安全建议

- 尽量使用应用专用密码或授权码，不要使用主账号密码。
- 公网部署建议保持 `REQUIRE_ACCESS_PASSWORD=true`。
- 如果 secret 曾经出现在聊天、截图、日志或提交记录里，请及时轮换。
- 不要提交 `.env.local`、`.vercel`、`.data`、`.next` 或 `node_modules`。

## Scripts

```bash
npm run dev
npm run typecheck
npm run build
npm run start
```

## License

MIT
