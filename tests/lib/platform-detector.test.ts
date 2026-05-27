import {
  getAvailablePlatforms,
  isPlatformAvailable,
  getPlatformsToPromoteTo,
} from "@/lib/platform-detector";

describe("platform-detector", () => {
  const invalidPlatform = "invalid" as unknown as "gitlab" | "github";

  describe("getAvailablePlatforms", () => {
    test("returns an array", () => {
      const platforms = getAvailablePlatforms();
      expect(Array.isArray(platforms)).toBe(true);
    });

    test("returned array contains only valid platform types", () => {
      const platforms = getAvailablePlatforms();
      const validPlatforms = ["gitlab", "github"];
      platforms.forEach((platform) => {
        expect(validPlatforms).toContain(platform);
      });
    });

    test("does not return duplicate platforms", () => {
      const platforms = getAvailablePlatforms();
      expect(new Set(platforms).size).toBe(platforms.length);
    });
  });

  describe("isPlatformAvailable", () => {
    test("returns boolean for gitlab", () => {
      const result = isPlatformAvailable("gitlab");
      expect(typeof result).toBe("boolean");
    });

    test("returns boolean for github", () => {
      const result = isPlatformAvailable("github");
      expect(typeof result).toBe("boolean");
    });

    test("returns false for invalid platform", () => {
      expect(isPlatformAvailable(invalidPlatform)).toBe(false);
    });

    test("consistent results across multiple calls", () => {
      const result1 = isPlatformAvailable("gitlab");
      const result2 = isPlatformAvailable("gitlab");
      expect(result1).toBe(result2);
    });
  });

  describe("getPlatformsToPromoteTo", () => {
    test("returns an array", () => {
      const platforms = getPlatformsToPromoteTo();
      expect(Array.isArray(platforms)).toBe(true);
    });

    test("returns subset of available platforms", () => {
      const allPlatforms = getAvailablePlatforms();
      const promoteToplatforms = getPlatformsToPromoteTo();

      promoteToplatforms.forEach((platform) => {
        expect(allPlatforms).toContain(platform);
      });
    });

    test("returns same as getAvailablePlatforms", () => {
      const available = getAvailablePlatforms();
      const promoteTo = getPlatformsToPromoteTo();

      expect(available).toEqual(promoteTo);
    });

    test("returns consistent results", () => {
      const result1 = getPlatformsToPromoteTo();
      const result2 = getPlatformsToPromoteTo();

      expect(result1).toEqual(result2);
    });
  });
});
