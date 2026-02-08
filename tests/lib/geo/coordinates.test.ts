import { describe, expect, it } from "vitest";
import {
  buildPlatformUrls,
  formatDecimal,
  formatDecimalCardinal,
  formatDdm,
  formatDms,
  parseCoordinateInput,
} from "@/lib/geo/coordinates";

describe("geo coordinates", () => {
  it("parses decimal coordinates", () => {
    const result = parseCoordinateInput("37.7749, -122.4194");
    expect(result.error).toBeUndefined();
    expect(result.coordinates?.lat).toBeCloseTo(37.7749, 6);
    expect(result.coordinates?.lng).toBeCloseTo(-122.4194, 6);
  });

  it("parses DMS coordinates", () => {
    const input = "37 46 29.64 N, 122 25 9.84 W";
    const result = parseCoordinateInput(input);
    expect(result.error).toBeUndefined();
    expect(result.coordinates?.lat).toBeCloseTo(37.7749, 3);
    expect(result.coordinates?.lng).toBeCloseTo(-122.4194, 3);
  });

  it("parses Google Maps URLs", () => {
    const input = "https://www.google.com/maps/@37.7749,-122.4194,12z";
    const result = parseCoordinateInput(input);
    expect(result.error).toBeUndefined();
    expect(result.coordinates?.lat).toBeCloseTo(37.7749, 6);
    expect(result.coordinates?.lng).toBeCloseTo(-122.4194, 6);
  });

  it("parses OpenStreetMap URLs", () => {
    const input =
      "https://www.openstreetmap.org/?mlat=37.7749&mlon=-122.4194#map=12/37.7749/-122.4194";
    const result = parseCoordinateInput(input);
    expect(result.error).toBeUndefined();
    expect(result.coordinates?.lat).toBeCloseTo(37.7749, 6);
    expect(result.coordinates?.lng).toBeCloseTo(-122.4194, 6);
  });

  it("parses geo URIs", () => {
    const result = parseCoordinateInput("geo:37.7749,-122.4194");
    expect(result.error).toBeUndefined();
    expect(result.coordinates?.lat).toBeCloseTo(37.7749, 6);
    expect(result.coordinates?.lng).toBeCloseTo(-122.4194, 6);
  });

  it("returns an error for invalid input", () => {
    const result = parseCoordinateInput("not-a-coordinate");
    expect(result.error).toBeDefined();
  });

  it("formats common coordinate styles", () => {
    expect(formatDecimal(37.7749, -122.4194, 4)).toBe("37.7749, -122.4194");
    expect(formatDecimalCardinal(37.7749, -122.4194, 4)).toBe(
      "37.7749 deg N, 122.4194 deg W",
    );
    expect(formatDms(37.7749, -122.4194)).toContain("deg");
    expect(formatDdm(37.7749, -122.4194)).toContain("deg");
  });

  it("builds platform URLs", () => {
    const urls = buildPlatformUrls(37.7749, -122.4194, 12);
    const ids = urls.map((entry) => entry.id);
    expect(ids).toContain("google-maps");
    expect(ids).toContain("apple-maps");
    expect(ids).toContain("openstreetmap");
  });
});
