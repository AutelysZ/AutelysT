import { describe, it, expect } from "vitest";
import {
  parseCidrInput,
  getCidrDetails,
  ipv4NetmaskToPrefix,
  prefixToIpv4Netmask,
  isIpInCidr,
} from "../../../lib/network/cidr";

describe("cidr", () => {
  it("parses IPv4 /24 CIDR and computes ranges", () => {
    const parsed = parseCidrInput("192.168.1.10/24", {
      ipv4: 24,
      ipv6: 64,
    });
    expect(parsed.error).toBeUndefined();
    const details = getCidrDetails(parsed.result!);
    expect(details.network).toBe("192.168.1.0");
    expect(details.broadcast).toBe("192.168.1.255");
    expect(details.netmask).toBe("255.255.255.0");
    expect(details.firstUsable).toBe("192.168.1.1");
    expect(details.lastUsable).toBe("192.168.1.254");
    expect(details.totalAddresses).toBe("256");
    expect(details.usableAddresses).toBe("254");
  });

  it("handles IPv4 /31 as point-to-point", () => {
    const parsed = parseCidrInput("10.0.0.0/31", { ipv4: 24, ipv6: 64 });
    expect(parsed.error).toBeUndefined();
    const details = getCidrDetails(parsed.result!);
    expect(details.firstUsable).toBe("10.0.0.0");
    expect(details.lastUsable).toBe("10.0.0.1");
    expect(details.usableAddresses).toBe("2");
  });

  it("parses IPv6 /64 CIDR and computes ranges", () => {
    const parsed = parseCidrInput("2001:db8::1/64", {
      ipv4: 24,
      ipv6: 64,
    });
    expect(parsed.error).toBeUndefined();
    const details = getCidrDetails(parsed.result!);
    expect(details.network).toBe("2001:db8::");
    expect(details.rangeEnd).toBe("2001:db8::ffff:ffff:ffff:ffff");
    expect(details.totalAddresses).toBe("18,446,744,073,709,551,616");
  });

  it("converts netmask to prefix and back", () => {
    const result = ipv4NetmaskToPrefix("255.255.254.0");
    expect(result.prefix).toBe(23);
    expect(prefixToIpv4Netmask(23)).toBe("255.255.254.0");
  });

  it("checks if IP is inside CIDR", () => {
    const parsed = parseCidrInput("192.168.0.0/24", {
      ipv4: 24,
      ipv6: 64,
    });
    const check = isIpInCidr("192.168.0.200", parsed.result!);
    expect(check.result?.inRange).toBe(true);
  });
});
