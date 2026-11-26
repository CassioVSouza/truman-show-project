import { describe, expect, it } from "vitest";
import { EN, PT_BR, stationLabel, t, toApiLang, translateDynamic } from "./index";

describe("viewer i18n", () => {
  it("keeps EN and PT-BR dictionaries 100% key-complete and non-empty", () => {
    const enKeys = Object.keys(EN).sort();
    const ptKeys = Object.keys(PT_BR).sort();
    expect(ptKeys).toEqual(enKeys);

    for (const key of enKeys) {
      expect(EN[key as keyof typeof EN].trim().length).toBeGreaterThan(0);
      expect(PT_BR[key as keyof typeof PT_BR].trim().length).toBeGreaterThan(0);
    }
  });

  it("resolves labels and API lang codes", () => {
    expect(t("en", "sectionLab")).toBe("Lab");
    expect(t("pt-BR", "navJournal")).toBe("Diário");
    expect(toApiLang("en")).toBe("en");
    expect(toApiLang("pt-BR")).toBe("pt");
    expect(stationLabel("pt-BR", "mirror_pool")).toBe("Lago Espelho");
    expect(stationLabel("en", null)).toBe("—");
  });

  it("handles dynamic translation with server fallback and EN fallback flag", async () => {
    const enRes = await translateDynamic("Hello cabin", "en");
    expect(enRes).toEqual({ text: "Hello cabin", lang: "en", isFallback: false });

    const srvRes = await translateDynamic(
      "Warm fire tonight",
      "pt-BR",
      async () => "Fogo quente esta noite",
    );
    expect(srvRes).toEqual({ text: "Fogo quente esta noite", lang: "pt", isFallback: false });

    const fallbackRes = await translateDynamic("Untranslated line", "pt-BR", async () => null);
    expect(fallbackRes).toEqual({ text: "Untranslated line", lang: "en", isFallback: true });
  });
});
