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
