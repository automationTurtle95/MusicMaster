// Baseline-Rate-Limiter (In-Memory, Single-Instance).
// Schützt v. a. die Credentials-Login-Route vor Brute-Force.
// Für Multi-Instanz/Serverless durch einen verteilten Store (z. B. Redis)
// ersetzen – siehe docs/SECURITY-REVIEW-LUH-15.md §4.

type Bucket = { count: number; resetAt: number };

const globalForRateLimit = globalThis as unknown as {
  __rateLimitStore?: Map<string, Bucket>;
};

const store = globalForRateLimit.__rateLimitStore ?? new Map<string, Bucket>();
globalForRateLimit.__rateLimitStore = store;

const WINDOW_MS = 60_000; // 1 Minute
const MAX_ATTEMPTS = 10; // Login-Versuche pro Key + Fenster

export function rateLimitAllow(key: string): boolean {
  const now = Date.now();
  const bucket = store.get(key);

  // Abgelaufene/neue Buckets zurücksetzen.
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  // Gelegentlich abgelaufene Einträge aufräumen (verhindert unbegrenztes Wachstum).
  if (store.size > 5000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
  }

  if (bucket.count >= MAX_ATTEMPTS) return false;
  bucket.count += 1;
  return true;
}
