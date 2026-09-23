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
import net from "net";

const MAX_RESPONSE_BYTES = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_REDIRECT_DEPTH = 5;

const blocked = new net.BlockList();
for (const [n, p] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const) {
  blocked.addSubnet(n, p, "ipv4");
}
for (const [n, p] of [["::", 96], ["fc00::", 7], ["fe80::", 10], ["64:ff9b::", 96], ["ff00::", 8]] as const) {
  blocked.addSubnet(n, p, "ipv6");
}

/**
 * True for loopback, private, link-local, CGNAT, benchmark, multicast/reserved,
 * ULA, NAT64 and IPv4-mapped forms of those (dotted or hex, e.g. ::ffff:7f00:1).
 */
export function isPrivateIP(ip: string): boolean {
  let bare = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const hex = bare.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const a = parseInt(hex[1], 16), b = parseInt(hex[2], 16);
    bare = `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  }
  bare = bare.replace(/^::ffff:(?=\d+\.)/, "");
  return blocked.check(bare, net.isIPv4(bare) ? "ipv4" : "ipv6");
}

/**
 * Resolve a hostname via DNS and validate that no answer is private.
 * Throws if the hostname resolves to a private/reserved IP.
 */
async function resolveAndValidateHost(hostname: string): Promise<void> {
  // If the hostname is already an IP literal, check directly
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(bare)) {
    if (isPrivateIP(bare)) {
      throw new Error(`Requests to private/internal addresses are not allowed: ${hostname}`);
    }
    return;
  }

  // ponytail: DNS-rebinding TOCTOU remains (fetch re-resolves); pin the address via an undici Agent
  // `connect.lookup` if this is ever exposed to untrusted remote callers
  const addresses = await dns.promises.lookup(hostname, { all: true });
  const bad = addresses.find((a) => isPrivateIP(a.address));
  if (bad) {
    throw new Error(
      `Requests to private/internal addresses are not allowed: ${hostname} resolved to ${bad.address}`
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
  // Covers the whole exchange, including the body download
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const timeoutError = () => new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s: ${url}`);

  const chunks: Buffer[] = [];
  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal, redirect: "manual" });
    } catch (err) {
      if ((err as Error).name === "AbortError") throw timeoutError();
      throw err;
    }

    // Handle redirects manually — validate each redirect target
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error(`Redirect response ${res.status} without Location header: ${url}`);
      }
      // Resolve relative redirects against the current URL
      const redirectUrl = new URL(location, url).toString();
      clearTimeout(timer);
      return safeFetchInternal(redirectUrl, depth + 1);
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }

    // Stream and cap the response body to avoid loading unbounded data into memory
    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error(`No response body for ${url}`);
    }

    let totalBytes = 0;
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
    } catch (err) {
      if ((err as Error).name === "AbortError") throw timeoutError();
      throw err;
    } finally {
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timer);
  }

  return Buffer.concat(chunks);
}
