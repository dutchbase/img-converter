/**
 * lib/safeFetch.ts
 * Fetch a remote URL as a Buffer with security guardrails:
 *   - Only HTTP/HTTPS URLs allowed
 *   - DNS resolution before fetch — resolved IP checked against private ranges (SSRF)
 *   - Redirects followed manually with target validation, depth capped at 5
 *   - 30-second timeout via AbortController
 *   - Response body capped at 50 MB
 *
 * Used by CLI, MCP server, and programmatic API whenever a URL is fetched.
 */

import dns from "dns";

const MAX_RESPONSE_BYTES = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_REDIRECT_DEPTH = 5;

/**
 * Check whether a resolved IP address falls in a private/reserved range.
 * Covers: loopback, RFC1918, link-local, shared address space, IPv6 loopback,
 * IPv4-mapped IPv6 (::ffff:*), ULA (fc00::/7), link-local v6 (fe80::/10),
 * and 0.0.0.0/8.
 */
function isPrivateIP(ip: string): boolean {
  // Handle IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1
  const mappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedMatch) {
    return isPrivateIPv4(mappedMatch[1]);
  }

  // Plain IPv4
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    return isPrivateIPv4(ip);
  }

  // IPv6
  return isPrivateIPv6(ip);
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 (shared address space / CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");

  // ::1 loopback
  if (normalized === "::1") return true;
  // :: (unspecified)
  if (normalized === "::") return true;
  // fc00::/7 — ULA (fc or fd prefix)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // fe80::/10 — link-local
  if (normalized.startsWith("fe80")) return true;

  return false;
}

/**
 * Resolve a hostname to an IP via DNS and validate it is not private.
 * Throws if the hostname resolves to a private/reserved IP.
 */
async function resolveAndValidateHost(hostname: string): Promise<void> {
  // If the hostname is already an IP literal, check directly
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(bare) || bare.includes(":")) {
    if (isPrivateIP(bare)) {
      throw new Error(`Requests to private/internal addresses are not allowed: ${hostname}`);
    }
    return;
  }

  // DNS lookup
  const { address } = await dns.promises.lookup(hostname);
  if (isPrivateIP(address)) {
    throw new Error(
      `Requests to private/internal addresses are not allowed: ${hostname} resolved to ${address}`
    );
  }
}

/**
 * Safely fetch a URL as a Buffer.
 *
 * @throws {Error} If the URL is not HTTP/HTTPS, targets a private IP,
 *                 times out, returns a non-2xx status, or exceeds the size cap.
 */
export async function safeFetch(url: string): Promise<Buffer> {
  return safeFetchInternal(url, 0);
}

async function safeFetchInternal(url: string, depth: number): Promise<Buffer> {
  if (depth > MAX_REDIRECT_DEPTH) {
    throw new Error(`Too many redirects (max ${MAX_REDIRECT_DEPTH}): ${url}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol '${parsed.protocol}' — only HTTP and HTTPS are allowed`);
  }

  // Resolve hostname and validate resolved IP is not private
  await resolveAndValidateHost(parsed.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, redirect: "manual" });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  // Handle redirects manually — validate each redirect target
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) {
      throw new Error(`Redirect response ${res.status} without Location header: ${url}`);
    }
    // Resolve relative redirects against the current URL
    const redirectUrl = new URL(location, url).toString();
    return safeFetchInternal(redirectUrl, depth + 1);
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  // Stream and cap the response body to avoid loading unbounded data into memory
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  // Node 18+ fetch returns a Web Streams ReadableStream; convert to async iterator
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error(`No response body for ${url}`);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        reader.cancel();
        throw new Error(
          `Response from ${url} exceeds the ${MAX_RESPONSE_BYTES / (1024 * 1024)} MB size limit`
        );
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}
