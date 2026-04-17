/**
 * lib/safeFetch.ts
 * Fetch a remote URL as a Buffer with security guardrails:
 *   - Only HTTP/HTTPS URLs allowed
 *   - Private/loopback IP ranges blocked (SSRF protection)
 *   - 30-second timeout via AbortController
 *   - Response body capped at 100 MB
 *
 * Used by CLI, MCP server, and programmatic API whenever a URL is fetched.
 */

import { Readable } from "stream";

const MAX_RESPONSE_BYTES = 100 * 1024 * 1024; // 100 MB
const FETCH_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Private/reserved IPv4 CIDR ranges that must not be reachable via user-supplied URLs.
 * This list covers loopback, link-local, RFC 1918 private ranges, and other
 * non-routable addresses commonly used in SSRF attacks.
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./,                    // 127.0.0.0/8  loopback
  /^10\./,                     // 10.0.0.0/8   RFC 1918
  /^192\.168\./,               // 192.168.0.0/16 RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 RFC 1918
  /^169\.254\./,               // 169.254.0.0/16 link-local
  /^0\./,                      // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 shared address space
  /^::1$/,                     // IPv6 loopback
  /^fc/i,                      // IPv6 ULA fc00::/7
  /^fd/i,                      // IPv6 ULA fd00::/8
  /^fe80:/i,                   // IPv6 link-local
];

function isPrivateHost(hostname: string): boolean {
  // Strip surrounding brackets for IPv6 literals like [::1]
  const host = hostname.replace(/^\[|\]$/g, "");
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(host));
}

/**
 * Safely fetch a URL as a Buffer.
 *
 * @throws {Error} If the URL is not HTTP/HTTPS, targets a private IP,
 *                 times out, returns a non-2xx status, or exceeds the size cap.
 */
export async function safeFetch(url: string): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol '${parsed.protocol}' — only HTTP and HTTPS are allowed`);
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new Error(`Requests to private/internal addresses are not allowed: ${parsed.hostname}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
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
