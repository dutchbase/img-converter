# External Integrations

**Analysis Date:** 2026-03-06

## APIs & External Services

**Font Delivery (Google Fonts via Next.js):**
- Google Fonts (Geist, Geist Mono) - Loaded via `next/font/google` in `app/layout.tsx`
  - SDK/Client: `next/font/google` (built into Next.js)
  - Auth: None required
  - Note: Next.js self-hosts the fonts at build/request time; no client-side Google Fonts CDN request at runtime

**No other external APIs are used.** The application is fully self-contained for its core image processing functionality.

## Data Storage

**Databases:**
- None. No database is used.

**File Storage:**
- No persistent file storage. Images are processed entirely in memory (`Buffer` in `lib/imageProcessor.ts`) and returned directly as binary responses. No files are written to disk.

**Caching:**
- None explicitly configured. Next.js default caching behavior applies to static assets.

## Authentication & Identity

**Auth Provider:**
- None. No authentication is implemented. The application is fully public with no user accounts or sessions.

## Monitoring & Observability

**Error Tracking:**
- None. No error tracking service (e.g., Sentry) is configured.

**Logs:**
- `console.error` in `app/api/convert/route.ts` for conversion failures. No structured logging framework.

## CI/CD & Deployment

**Hosting:**
- Not configured. No `Dockerfile`, `vercel.json`, `.github/workflows/`, or other deployment manifests are present.

**CI Pipeline:**
- None. No CI configuration detected.

## Environment Configuration

**Required env vars:**
- None. The application requires no environment variables to run.

**Secrets location:**
- Not applicable. No secrets, API keys, or credentials are used.
- No `.env` files present in the repository.

## Webhooks & Callbacks

**Incoming:**
- None. The only HTTP endpoint is `POST /api/convert` (`app/api/convert/route.ts`), which is a user-facing form submission, not a webhook receiver.

**Outgoing:**
- None. The server makes no outbound HTTP requests.

---

*Integration audit: 2026-03-06*
