import type { SourceRule } from "@/lib/config";

type MatchInput = {
  from: string;
  subject: string;
  text: string;
};

const CODE_PATTERNS: RegExp[] = [
  /(?:your code\s*[-:：]?\s*)([0-9]{4,8})/i,
  /(?:code is\s*[:：]?\s*)([0-9]{4,8})/i,
  /(?:验证码是|验证码为|临时验证码|登录代码|安全码|account security code|login code|temporary verification code|verification code|verify code|security code|otp|passcode)[^a-z0-9]{0,24}([0-9]{4,8})/i,
  /(?:验证码|校验码|动态码|确认码|认证码|verification code|verify code|security code|login code|one-time password|otp|passcode)[^a-z0-9]{0,24}([0-9]{4,8})/i,
  /(?:验证码|校验码|动态码|确认码|认证码|verification code|verify code|security code|login code|one-time password|otp|passcode)[^a-z0-9]{0,24}([a-z0-9]{4,10})/i,
  /(?:输入此临时验证码以继续|Use it to verify|仅可使用一次|请在\s*\d+\s*分钟内进行验证|验证码仅用于)[^0-9]{0,24}([0-9]{4,8})/i,
  /[:：\s]\s*([0-9]{4,8})\b/,
  /\b([0-9]{4,8})\b/
];

const OTP_HINTS = [
  "验证码",
  "校验码",
  "动态码",
  "确认码",
  "认证码",
  "verification code",
  "verify code",
  "security code",
  "login code",
  "one-time password",
  "otp",
  "passcode"
];

function includesAny(haystack: string, needles: string[] | undefined) {
  if (!needles || needles.length === 0) {
    return true;
  }

  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

export function matchesRule(input: MatchInput, rule: SourceRule) {
  const from = input.from.toLowerCase();
  const subject = input.subject.toLowerCase();
  const text = input.text.toLowerCase();

  return (
    includesAny(from, rule.senders) &&
    includesAny(subject, rule.subjectKeywords) &&
    includesAny(text, rule.bodyKeywords)
  );
}

export function looksLikeOtpMessage(input: MatchInput) {
  const haystack = `${input.subject}\n${input.text}`.toLowerCase();
  return OTP_HINTS.some((hint) => haystack.includes(hint));
}

export function extractVerificationCode(text: string) {
  const normalized = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of CODE_PATTERNS) {
    const match = pattern.exec(normalized);

    if (match?.[1]) {
      const candidate = match[1].trim();

      if (/^\d{4,8}$/.test(candidate)) {
        return candidate;
      }

      // Only allow alphanumeric fallback codes when the token itself contains digits.
      if (/^(?=.*\d)[a-z0-9]{4,10}$/i.test(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function makeExcerpt(text: string, code: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "无正文摘要";
  }

  const index = normalized.indexOf(code);
  if (index === -1) {
    return normalized.slice(0, 120);
  }

  const start = Math.max(0, index - 36);
  const end = Math.min(normalized.length, index + code.length + 48);
  return normalized.slice(start, end);
}
