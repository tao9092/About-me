import "server-only";

type Entry = { count: number; resetsAt: number };
const buckets = new Map<string, Entry>();

export function checkRateLimit(key: string, limit = 5, windowMs = 10 * 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetsAt <= now) {
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfter: Math.ceil((current.resetsAt - now) / 1000) };
}
