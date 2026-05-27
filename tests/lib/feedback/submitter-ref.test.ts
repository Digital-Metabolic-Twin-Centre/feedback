import { deriveSubmitterRef } from "@/lib/feedback/submitter-ref";

describe("feedback/submitter-ref", () => {
  describe("deriveSubmitterRef", () => {
    test("generates submitter ref from email", () => {
      const ref = deriveSubmitterRef("user@example.com");

      expect(ref).toMatch(/^usr_[a-f0-9]{12}$/);
    });

    test("is deterministic - same email generates same ref", () => {
      const email = "user@example.com";
      const ref1 = deriveSubmitterRef(email);
      const ref2 = deriveSubmitterRef(email);

      expect(ref1).toBe(ref2);
    });

    test("normalizes email to lowercase", () => {
      const ref1 = deriveSubmitterRef("User@Example.com");
      const ref2 = deriveSubmitterRef("user@example.com");

      expect(ref1).toBe(ref2);
    });

    test("trims whitespace from email", () => {
      const ref1 = deriveSubmitterRef("  user@example.com  ");
      const ref2 = deriveSubmitterRef("user@example.com");

      expect(ref1).toBe(ref2);
    });

    test("generates different refs for different emails", () => {
      const ref1 = deriveSubmitterRef("user1@example.com");
      const ref2 = deriveSubmitterRef("user2@example.com");

      expect(ref1).not.toBe(ref2);
    });

    test("has usr_ prefix", () => {
      const ref = deriveSubmitterRef("test@example.com");

      expect(ref.substring(0, 4)).toBe("usr_");
    });

    test("is 16 characters total (4 prefix + 12 hash)", () => {
      const ref = deriveSubmitterRef("test@example.com");

      expect(ref.length).toBe(16);
    });

    test("uses only hexadecimal characters after prefix", () => {
      const ref = deriveSubmitterRef("test@example.com");
      const hashPart = ref.slice(4);

      expect(hashPart).toMatch(/^[a-f0-9]{12}$/);
    });

    test("handles emails with special characters", () => {
      const ref = deriveSubmitterRef("user+tag@example.co.uk");

      expect(ref).toMatch(/^usr_[a-f0-9]{12}$/);
    });

    test("handles very long emails", () => {
      const longEmail = "verylongemailaddresswithalotofcharacters@subdomain.example.com";
      const ref = deriveSubmitterRef(longEmail);

      expect(ref).toMatch(/^usr_[a-f0-9]{12}$/);
    });

    test("handles emails with numbers", () => {
      const ref = deriveSubmitterRef("user123@example456.com");

      expect(ref).toMatch(/^usr_[a-f0-9]{12}$/);
    });

    test("case insensitivity produces same ref", () => {
      const ref1 = deriveSubmitterRef("USER@EXAMPLE.COM");
      const ref2 = deriveSubmitterRef("user@example.com");
      const ref3 = deriveSubmitterRef("UsEr@ExAmPlE.cOm");

      expect(ref1).toBe(ref2);
      expect(ref2).toBe(ref3);
    });

    test("whitespace handling with case insensitivity", () => {
      const ref1 = deriveSubmitterRef("  USER@EXAMPLE.COM  ");
      const ref2 = deriveSubmitterRef("user@example.com");

      expect(ref1).toBe(ref2);
    });

    test("does not expose original email", () => {
      const email = "secret@example.com";
      const ref = deriveSubmitterRef(email);

      expect(ref).not.toContain(email);
      expect(ref).not.toContain("secret");
      expect(ref).not.toContain("example.com");
    });

    test("handles international domain names", () => {
      const ref = deriveSubmitterRef("user@münchen.de");

      expect(ref).toMatch(/^usr_[a-f0-9]{12}$/);
    });

    test("handles single character local part", () => {
      const ref = deriveSubmitterRef("a@example.com");

      expect(ref).toMatch(/^usr_[a-f0-9]{12}$/);
    });

    test("handles single character domain", () => {
      const ref = deriveSubmitterRef("user@a.c");

      expect(ref).toMatch(/^usr_[a-f0-9]{12}$/);
    });

    test("consistent hashing across multiple calls in same session", () => {
      const refs = [1, 2, 3, 4, 5].map(() =>
        deriveSubmitterRef("test@example.com")
      );

      expect(new Set(refs).size).toBe(1);
    });
  });
});
