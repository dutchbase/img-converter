import { isPrivateIP, safeFetch } from "@/lib/safeFetch";

describe("isPrivateIP", () => {
  it.each(["127.0.0.1", "10.1.2.3", "169.254.169.254", "198.18.0.1", "224.0.0.1", "255.255.255.255",
    "::1", "::", "::ffff:127.0.0.1", "::ffff:7f00:1", "::7f00:1", "fd00::1", "fe80::1", "64:ff9b::a9fe:a9fe"])(
    "blocks %s", (ip) => expect(isPrivateIP(ip)).toBe(true));
  it.each(["8.8.8.8", "2606:4700::1111", "::ffff:808:808"])("allows %s", (ip) => expect(isPrivateIP(ip)).toBe(false));
});

it("rejects bracketed IPv4-mapped loopback URL", async () => {
  await expect(safeFetch("http://[::ffff:127.0.0.1]/")).rejects.toThrow(/private/);
});

describe("safeFetch with a stubbed network", () => {
  const realFetch = global.fetch;
  const dns = jest.requireActual("dns") as typeof import("dns");
  let lookup: jest.SpyInstance;

  beforeEach(() => {
    lookup = jest.spyOn(dns.promises, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
  });
  afterEach(() => {
    global.fetch = realFetch;
    lookup.mockRestore();
  });

  it("returns the body for a public host", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("image-bytes"));
    expect((await safeFetch("https://example.com/a.png")).toString()).toBe("image-bytes");
  });

  it("re-validates redirect targets and blocks private ones", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/x" } }));
    await expect(safeFetch("https://example.com/a.png")).rejects.toThrow(/private/);
  });

  it("blocks hosts whose DNS answers include a private address", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }] as never);
    await expect(safeFetch("https://example.com/a.png")).rejects.toThrow(/10\.0\.0\.5/);
  });

  it("rejects non-2xx responses and non-HTTP protocols", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("nope", { status: 404, statusText: "Not Found" }));
    await expect(safeFetch("https://example.com/a.png")).rejects.toThrow(/404/);
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(/protocol/);
    await expect(safeFetch("not a url")).rejects.toThrow(/Invalid URL/);
  });

  it("caps the response size", async () => {
    const big = new Uint8Array(51 * 1024 * 1024);
    global.fetch = jest.fn().mockResolvedValue(new Response(big));
    await expect(safeFetch("https://example.com/a.png")).rejects.toThrow(/size limit/);
  });

  it("stops after too many redirects", async () => {
    global.fetch = jest.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "/next" } }));
    await expect(safeFetch("https://example.com/a.png")).rejects.toThrow(/Too many redirects/);
  });
});
