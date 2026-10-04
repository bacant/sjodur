import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createAppI18n } from "../lib/i18n";
import AmountChip from "./AmountChip.vue";

describe("AmountChip", () => {
  it("renders a gain in the accent colour", () => {
    const wrapper = mount(AmountChip, {
      props: { amount: "1234.56" },
      global: { plugins: [createAppI18n("de")] },
    });
    expect(wrapper.text()).toBe("1.234,56\u00a0€");
    expect(wrapper.classes()).toContain("text-glacier-deep");
  });

  it("renders a loss in amber", () => {
    const wrapper = mount(AmountChip, {
      props: { amount: "-87.9" },
      global: { plugins: [createAppI18n("en")] },
    });
    expect(wrapper.text()).toBe("-€87.90");
    expect(wrapper.classes()).toContain("text-amber-deep");
  });
});
