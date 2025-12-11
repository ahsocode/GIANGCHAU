"use client";

const DEFAULT_TTL_MS = 5000;
const inflight = new Map<string, Promise<Response>>();
const cache = new Map<
  string,
  { body: ArrayBuffer; init: ResponseInit; expires: number }
>();

function buildKey(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;
  return { method, url, key: `${method}:${url}` };
}

function shouldBypass(input: RequestInfo | URL, url: string, init?: RequestInit) {
  if (url.includes("__server_sent_events__")) return true;
  const headers = new Headers(
    init?.headers || (input instanceof Request ? input.headers : undefined)
  );
  const accept = headers.get("accept") || "";
  const bypassHeader = headers.get("x-bypass-cache");
  if (bypassHeader === "1") return true;
  if (accept.includes("text/event-stream")) return true;
  if (init?.cache === "no-store") return true;
  return false;
}

export function ensurePatchedFetch(ttlMs: number = DEFAULT_TTL_MS) {
  if (typeof window === "undefined") return;
  type PatchedWindow = typeof window & { __FETCH_DEDUP_PATCHED__?: boolean };
  const w = window as PatchedWindow;
  if (w.__FETCH_DEDUP_PATCHED__) return;
  const original = w.fetch.bind(w);
  w.__FETCH_DEDUP_PATCHED__ = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const { method, url, key } = buildKey(input, init);
    if (method !== "GET" || shouldBypass(input, url, init)) {
      return original(input, init);
    }

    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expires > now) {
      return new Response(cached.body.slice(0), cached.init);
    }

    const inflightReq = inflight.get(key);
    if (inflightReq) {
      return inflightReq.then((res) => res.clone());
    }

    const reqPromise = original(input, init)
      .then(async (res) => {
        try {
          const clone = res.clone();
          const body = await clone.arrayBuffer();
          const headersObj: Record<string, string> = {};
          clone.headers.forEach((v, k) => {
            headersObj[k] = v;
          });
          cache.set(key, {
            body,
            init: {
              status: clone.status,
              statusText: clone.statusText,
              headers: headersObj,
            },
            expires: Date.now() + ttlMs,
          });
        } catch {
          // ignore cache errors
        }
        return res;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, reqPromise);
    return reqPromise;
  };
}
