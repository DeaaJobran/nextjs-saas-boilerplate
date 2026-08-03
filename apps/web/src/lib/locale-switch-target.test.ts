import { describe, expect, it } from "vitest";

import { resolveLocaleSwitchTarget } from "./locale-switch-target";

describe("resolveLocaleSwitchTarget", () => {
  it("preserves routes that are not managed content", () => {
    expect(
      resolveLocaleSwitchTarget({
        availableLocales: ["en", "ar"],
        currentLocale: "en",
        managedRoutesByLocale: {
          ar: ["/"],
          en: ["/", "/pricing"],
        },
        pathname: "/api",
      }),
    ).toEqual({ locale: "ar", pathname: "/api" });
  });

  it("falls back to a public landing page when the managed route is unavailable", () => {
    expect(
      resolveLocaleSwitchTarget({
        availableLocales: ["en", "ar"],
        currentLocale: "en",
        managedRoutesByLocale: {
          ar: ["/"],
          en: ["/", "/pricing"],
        },
        pathname: "/pricing",
      }),
    ).toEqual({ locale: "ar", pathname: "/" });
  });

  it("hides the switch when neither the route nor a landing fallback is public", () => {
    expect(
      resolveLocaleSwitchTarget({
        availableLocales: ["en", "ar"],
        currentLocale: "en",
        managedRoutesByLocale: {
          ar: [],
          en: ["/", "/pricing"],
        },
        pathname: "/pricing",
      }),
    ).toBeUndefined();
  });
});
