// Error classification — regex-based API error categorization (1:1 z CheetahClaws)
export type ErrorCategory = "AUTH_ERROR" | "RATE_LIMIT" | "QUOTA_EXCEEDED" | "MODEL_UNAVAILABLE" | "CONTEXT_TOO_LONG" | "TIMEOUT" | "SERVER_ERROR" | "NETWORK_ERROR" | "INVALID_REQUEST" | "UNKNOWN";

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  recoveryHint: string;
  retryable: boolean;
  provider?: string;
}

const PATTERNS: Array<{ regex: RegExp; category: ErrorCategory; hint: string; retryable: boolean }> = [
  { regex: /401|unauthorized|api key|invalid.*key|auth/i, category: "AUTH_ERROR", hint: "Check your API key in .env file", retryable: false },
  { regex: /429|rate limit|too many requests|try again.*later/i, category: "RATE_LIMIT", hint: "Wait and retry", retryable: true },
  { regex: /insufficient_quota|exceeded.*quota|quota.*exceeded|billing/i, category: "QUOTA_EXCEEDED", hint: "Check your API billing", retryable: false },
  { regex: /model not found|not supported|model.*unavailable|not found/i, category: "MODEL_UNAVAILABLE", hint: "Check model name", retryable: false },
  { regex: /context.*length|tokens.*too long|too many tokens|maximum.*context/i, category: "CONTEXT_TOO_LONG", hint: "Reduce message length", retryable: false },
  { regex: /timeout|timed out|time.*out/i, category: "TIMEOUT", hint: "Retry", retryable: true },
  { regex: /5\d\d|internal server|server error|service unavailable|overloaded/i, category: "SERVER_ERROR", hint: "Provider is experiencing issues", retryable: true },
  { regex: /econnrefused|econnreset|enotfound|fetch.*failed|network/i, category: "NETWORK_ERROR", hint: "Check network connectivity", retryable: true },
];

export function classifyError(exc: unknown, provider?: string): ClassifiedError {
  const message = exc instanceof Error ? exc.message : String(exc);
  for (const p of PATTERNS) {
    if (p.regex.test(message)) {
      return { category: p.category, message, recoveryHint: p.hint, retryable: p.retryable, provider };
    }
  }
  return { category: "UNKNOWN", message, recoveryHint: "Unknown error", retryable: false, provider };
}
