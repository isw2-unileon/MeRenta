import { describe, expect, it } from "vitest";

import { EUR_FORMAT, fmtDate, fmtPrice } from "@/components/admin/adminFormat";

describe("adminFormat", () => {
  it("formats ISO dates with the Spanish short date format", () => {
    expect(fmtDate("2026-06-04T12:00:00.000Z")).toContain("2026");
  });

  it("renders empty dates and prices with the configured placeholder", () => {
    expect(fmtDate("")).toBe("\u2014");
    expect(fmtPrice(null)).toBe("\u2014");
  });

  it("formats EUR prices through the shared formatter", () => {
    expect(fmtPrice(12.5)).toBe(EUR_FORMAT.format(12.5));
  });
});
