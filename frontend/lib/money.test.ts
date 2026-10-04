import { describe, expect, it } from "vitest";
import { amountTone, formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats euro amounts the German way", () => {
    expect(formatMoney("1234.56")).toBe("1.234,56\u00a0€");
  });

  it("formats negative amounts and other locales", () => {
    expect(formatMoney(-42, "EUR", "en-IE")).toBe("-€42.00");
  });

  it("rejects values that are not numbers", () => {
    expect(() => formatMoney("abc")).toThrow(TypeError);
  });
});

describe("amountTone", () => {
  it("maps sign to tone", () => {
    expect(amountTone("12.00")).toBe("gain");
    expect(amountTone(-0.01)).toBe("loss");
    expect(amountTone("0")).toBe("neutral");
  });
});
