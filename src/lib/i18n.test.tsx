/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  I18nProvider,
  LOCALE_KEY,
  resolveInitialLocale,
  useI18n,
} from "./i18n";

describe("resolveInitialLocale", () => {
  it("prefers a valid cookie locale over Accept-Language", () => {
    expect(
      resolveInitialLocale({
        cookieLocale: "en",
        acceptLanguage: "zh-CN,zh;q=0.9,en;q=0.8",
      }),
    ).toBe("en");
  });

  it("falls back to Accept-Language when no valid cookie exists", () => {
    expect(
      resolveInitialLocale({
        cookieLocale: "fr",
        acceptLanguage: "zh-CN,zh;q=0.9,en;q=0.8",
      }),
    ).toBe("zh-CN");
  });

  it("defaults to english when no supported language is present", () => {
    expect(resolveInitialLocale({ acceptLanguage: "fr-FR,fr;q=0.9" })).toBe("en");
  });
});

describe("I18nProvider", () => {
  let store: Record<string, string>;

  function Harness() {
    const { locale, setLocale, t } = useI18n();
    return (
      <div>
        <div data-testid="locale">{locale}</div>
        <div data-testid="label">{t("header.language")}</div>
        <button type="button" onClick={() => setLocale("zh-CN")}>
          zh-CN
        </button>
      </div>
    );
  }

  beforeEach(() => {
    store = {};
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: (key: string) => (key in store ? store[key] : null),
        setItem: (key: string, value: string) => {
          store[key] = String(value);
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
      },
      configurable: true,
    });
    document.cookie = "";
    document.documentElement.lang = "";
    delete document.documentElement.dataset.locale;
  });

  afterEach(() => {
    window.localStorage.clear();
    document.cookie = "";
    document.documentElement.lang = "";
    delete document.documentElement.dataset.locale;
  });

  it("uses the server-provided initial locale on first render", () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <Harness />
      </I18nProvider>,
    );

    expect(screen.getByTestId("locale").textContent).toBe("zh-CN");
    expect(screen.getByTestId("label").textContent).toBe("语言");
  });

  it("persists locale changes to the document, localStorage, and cookie", async () => {
    render(
      <I18nProvider initialLocale="en">
        <Harness />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "zh-CN" }));

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("zh-CN");
    });
    expect(document.documentElement.dataset.locale).toBe("zh-CN");
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe("zh-CN");
    expect(document.cookie).toContain(`${LOCALE_KEY}=zh-CN`);
  });
});
