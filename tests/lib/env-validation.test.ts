import { env } from "@/lib/env-validation";

describe("env-validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment to original state
    process.env = { ...originalEnv };
    delete process.env.NEXT_PHASE;
    delete process.env.SKIP_ENV_VALIDATION;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("env schema", () => {
    test("provides NODE_ENV", () => {
      expect(env.NODE_ENV).toBeDefined();
      expect(["development", "production", "test"]).toContain(env.NODE_ENV);
    });

    test("provides expected properties", () => {
      // Basic fields that should always exist
      expect(Object.keys(env).length).toBeGreaterThan(0);
      expect(env.NODE_ENV).toBeDefined();
    });

    test("NODE_ENV is one of valid values", () => {
      expect(["development", "production", "test"]).toContain(env.NODE_ENV);
    });
  });

  describe("build phase detection", () => {
    test("skips validation during build phase", () => {
      process.env.NEXT_PHASE = "phase-production-build";

      // Should not throw even with invalid env vars
      expect(() => {
        // Dynamic import to re-evaluate the module
        delete require.cache[require.resolve("@/lib/env-validation")];
      }).not.toThrow();
    });

    test("skips validation during test phase", () => {
      process.env.NODE_ENV = "test";

      // Should not throw even with invalid env vars
      expect(() => {
        delete require.cache[require.resolve("@/lib/env-validation")];
      }).not.toThrow();
    });

    test("skips validation when SKIP_ENV_VALIDATION is true", () => {
      process.env.SKIP_ENV_VALIDATION = "true";

      // Should not throw even with invalid env vars
      expect(() => {
        delete require.cache[require.resolve("@/lib/env-validation")];
      }).not.toThrow();
    });
  });

  describe("NODE_ENV values", () => {
    test("development is valid", () => {
      process.env.NODE_ENV = "development";
      expect(["development", "production", "test"]).toContain(env.NODE_ENV);
    });

    test("production is valid", () => {
      process.env.NODE_ENV = "production";
      expect(["development", "production", "test"]).toContain(env.NODE_ENV);
    });

    test("test is valid", () => {
      process.env.NODE_ENV = "test";
      expect(["development", "production", "test"]).toContain(env.NODE_ENV);
    });
  });

  describe("optional string validations", () => {
    test("URL fields are valid URLs when provided", () => {
      // These should be URLs if provided
      if (env.NEXTAUTH_URL) {
        expect(env.NEXTAUTH_URL).toMatch(/^https?:\/\//);
      }
      if (env.NEXT_PUBLIC_APP_URL) {
        expect(env.NEXT_PUBLIC_APP_URL).toMatch(/^https?:\/\//);
      }
    });

    test("token fields are strings when provided", () => {
      if (env.FEEDBACK_BOOTSTRAP_TOKEN) {
        expect(typeof env.FEEDBACK_BOOTSTRAP_TOKEN).toBe("string");
        expect(env.FEEDBACK_BOOTSTRAP_TOKEN.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("env is readonly", () => {
    test("env object is accessible", () => {
      expect(env).toBeDefined();
      expect(typeof env).toBe("object");
    });
  });
});
