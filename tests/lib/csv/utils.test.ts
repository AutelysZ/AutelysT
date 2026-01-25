import { describe, it, expect } from "vitest";
import {
  parseCsv,
  stringifyCsv,
  stripCsvExtension,
  isValidSheetName,
} from "../../../lib/csv/utils";

describe("csv utils", () => {
  it("parses CSV with quotes and commas", () => {
    const input = '"a","b, c","d""e"\n1,2,3';
    const rows = parseCsv(input);
    expect(rows).toEqual([
      ["a", "b, c", 'd"e'],
      ["1", "2", "3"],
    ]);
  });

  it("parses CSV with different newlines", () => {
    const input = "a,b\r\nc,d\ne,f";
    const rows = parseCsv(input);
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });

  it("stringifies CSV with escaping", () => {
    const rows = [
      ["a", "b, c", 'd"e'],
      ["1", "2", "3"],
    ];
    const csv = stringifyCsv(rows);
    expect(csv).toBe('a,"b, c","d""e"\n1,2,3');
  });

  it("strips csv extension", () => {
    expect(stripCsvExtension("data.csv")).toBe("data");
    expect(stripCsvExtension("Data.CSV")).toBe("Data");
    expect(stripCsvExtension("data.txt")).toBe("data.txt");
  });

  it("validates sheet names", () => {
    expect(isValidSheetName("ShortName")).toBe(true);
    expect(isValidSheetName("")).toBe(false);
    expect(
      isValidSheetName("this-name-is-way-too-long-to-be-valid-in-excel"),
    ).toBe(false);
    expect(isValidSheetName("bad:name")).toBe(false);
    expect(isValidSheetName("ok_name_123")).toBe(true);
  });
});
