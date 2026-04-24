"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

type ApiResponse = {
  ok: boolean;
  items: CodeItem[];
  sources: { id: string; label: string }[];
  accounts?: {
    id: string;
    label: string;
    user: string;
    kind: string;
    connected?: boolean;
    expiresAt?: number;
  }[];
  phoneAliases?: { phone: string; accountId: string; label?: string }[];
  lookbackMinutes: number;
  mailbox?: string;
  resolvedPhone?: string | null;
  requireAccessPassword?: boolean;
  scanned?: number;
  matched?: number;
  warnings?: string[];
  message?: string;
};

type HealthResponse = {
  ok: boolean;
  service: string;
  requireAccessPassword?: boolean;
};

export default function HomePage() {
  const [password, setPassword] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [submittedPassword, setSubmittedPassword] = useState("");
  const [submittedIdentifier, setSubmittedIdentifier] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");
  const [items, setItems] = useState<CodeItem[]>([]);
  const [sources, setSources] = useState<{ id: string; label: string }[]>([]);
  const [accounts, setAccounts] = useState<
    { id: string; label: string; user: string; kind: string; connected?: boolean; expiresAt?: number }[]
  >([]);
  const [phoneAliases, setPhoneAliases] = useState<
    { phone: string; accountId: string; label?: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lookbackMinutes, setLookbackMinutes] = useState(30);
  const [mailbox, setMailbox] = useState("");
  const [activeItem, setActiveItem] = useState<CodeItem | null>(null);
  const [modalItem, setModalItem] = useState<CodeItem | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [scanned, setScanned] = useState(0);
  const [requireAccessPassword, setRequireAccessPassword] = useState(false);
  const [queryNonce, setQueryNonce] = useState(0);

  function normalizePhone(input: string) {
    return input.replace(/\D/g, "");
  }

  const outlookAccount = useMemo(() => {
    return accounts.find((item) => item.kind === "outlook") ?? null;
  }, [accounts]);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health");
        const data = (await response.json()) as HealthResponse;

        if (!cancelled) {
          setRequireAccessPassword(Boolean(data.requireAccessPassword));
        }
      } catch {
        // Ignore health fetch failures and let the query flow handle errors.
      }
    }

    loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const identifierFromUrl = params.get("identifier");
    const outlookError = params.get("outlook_error");

    if (identifierFromUrl) {
      setIdentifier(identifierFromUrl);
      setSubmittedIdentifier(identifierFromUrl);
    }

    if (outlookError) {
      setError(outlookError);
    }
  }, []);

  async function loadCodes(
    sourceId: string,
    accessPassword: string,
    userInput: string
  ) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      const normalizedPhone = normalizePhone(userInput);
      const looksLikePhone = Boolean(normalizedPhone) && normalizedPhone === userInput.trim();
      const matchedAlias = phoneAliases.find((item) => item.phone === normalizedPhone);

      if (matchedAlias || looksLikePhone) {
        params.set("phone", normalizedPhone);
      }
      if (userInput && !matchedAlias && !looksLikePhone) {
        params.set("email", userInput);
      }
      if (sourceId && sourceId !== "all") {
        params.set("source", sourceId);
      }

      const response = await fetch(`/api/codes?${params.toString()}`, {
        headers: {
          "x-access-password": accessPassword
        }
      });

      const data = (await response.json()) as ApiResponse;

      if (response.status === 401) {
        setRequireAccessPassword(true);
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "读取验证码失败");
      }

      setItems(data.items);
      setSources(data.sources);
      setAccounts(data.accounts ?? []);
      setPhoneAliases(data.phoneAliases ?? []);
      setLookbackMinutes(data.lookbackMinutes);
      setMailbox(data.mailbox ?? "");
      setActiveItem(data.items[0] ?? null);
      setModalItem(data.items[0] ?? null);
      setWarnings(data.warnings ?? []);
      setScanned(data.scanned ?? 0);
      setRequireAccessPassword(Boolean(data.requireAccessPassword));
    } catch (err) {
      setItems([]);
      setSources([]);
      setAccounts([]);
      setPhoneAliases([]);
      setActiveItem(null);
      setModalItem(null);
      setWarnings([]);
      setScanned(0);
      setError(err instanceof Error ? err.message : "读取验证码失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (queryNonce === 0 || (requireAccessPassword && !submittedPassword) || !submittedIdentifier) {
      return;
    }

    loadCodes(selectedSource, submittedPassword, submittedIdentifier);
  }, [queryNonce, selectedSource, submittedPassword, submittedIdentifier, requireAccessPassword]);

  const groupedInfo = useMemo(() => {
    return sources.find((source) => source.id === selectedSource);
  }, [selectedSource, sources]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedPassword(password);
    const trimmed = identifier.trim();
    setSubmittedIdentifier(trimmed);
    setQueryNonce((value) => value + 1);
  }

  return (
    <main className="page-shell">
      <section className="simple-panel">
        <div className="brand-bar">
          <div className="brand-mark">S</div>
          <div className="brand-copy">
            <span className="brand-title">验证码查询</span>
            <span className="brand-subtitle">只读你自己授权的邮箱</span>
          </div>
        </div>

        <div className="headline">
          <h1>邮箱验证码查询</h1>
          <p>输入手机或邮箱和访问口令，查询最近 {lookbackMinutes} 分钟内命中的验证码。</p>
        </div>

        <form className="query-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>手机号或邮箱</span>
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="输入手机或直接输入邮箱"
            />
          </label>

          {requireAccessPassword ? (
            <label className="field">
              <span>访问口令</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入网页访问口令"
              />
            </label>
          ) : null}

          <label className="field">
            <span>验证码来源</span>
            <select
              value={selectedSource}
              onChange={(event) => setSelectedSource(event.target.value)}
            >
              <option value="all">
                {sources.length > 0 ? "全部允许来源" : "自动识别验证码"}
              </option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="primary-button primary-full" disabled={loading}>
            {loading ? "查询中..." : "查询验证码"}
          </button>
        </form>

        {identifier.includes("@outlook.") ? (
          <div className="warning-box">
            <div>
              Outlook 账户需要先完成微软授权
              {outlookAccount?.connected && outlookAccount.user === identifier.trim()
                ? "，当前已连接。"
                : "，未连接时无法读取邮件。"}
            </div>
            <div style={{ marginTop: 10 }}>
              <a
                className="secondary-button"
                href={`/api/outlook/connect?email=${encodeURIComponent(
                  identifier.trim()
                )}`}
              >
                连接 Outlook 授权
              </a>
            </div>
          </div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        <div className="status-strip">
          <span>当前邮箱：{mailbox || "未查询"}</span>
          <span>来源：{groupedInfo?.label ?? (sources.length > 0 ? "全部允许来源" : "自动识别")}</span>
          <span>扫描：{scanned} 封</span>
          <span>结果：{items.length} 条</span>
        </div>

        {warnings.length > 0 ? (
          <div className="warning-box">
            {warnings[0]}
          </div>
        ) : null}

        {activeItem ? (
          <section className="result-card">
            <div className="result-heading">
              <span className="source-badge">{activeItem.accountLabel}</span>
              <time>{new Date(activeItem.receivedAt).toLocaleString("zh-CN")}</time>
            </div>
            <div className="result-code">{activeItem.code}</div>
            <div className="result-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => navigator.clipboard.writeText(activeItem.code)}
              >
                复制验证码
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setModalItem(activeItem)}
              >
                弹窗查看
              </button>
            </div>
          </section>
        ) : null}

        {!loading && !error && submittedIdentifier && items.length === 0 ? (
          <div className="empty-state">没有找到符合规则的验证码邮件。</div>
        ) : null}

        {items.length > 0 ? (
          <section className="history-block">
            <div className="history-title">最近结果</div>
            <div className="history-list">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`history-item ${activeItem?.id === item.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveItem(item);
                    setModalItem(item);
                  }}
                >
                  <span>{item.accountLabel}</span>
                  <strong>{item.code}</strong>
                  <time>{new Date(item.receivedAt).toLocaleTimeString("zh-CN")}</time>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </section>

      {modalItem ? (
        <div className="modal-backdrop" onClick={() => setModalItem(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-top">
              <span className="source-badge">{modalItem.accountLabel}</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalItem(null)}
              >
                关闭
              </button>
            </div>
            <div className="modal-code">{modalItem.code}</div>
            <button
              type="button"
              className="primary-button primary-full"
              onClick={() => navigator.clipboard.writeText(modalItem.code)}
            >
              复制验证码
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
