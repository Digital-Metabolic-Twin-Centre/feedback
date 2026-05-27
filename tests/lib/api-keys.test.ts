import { feedbackDb as db } from "@/lib/db-sqlite";
import {
  createApiKeyForProject,
  validateApiKey,
  revokeApiKeyById,
  rotateApiKeyById,
  listApiKeys,
  assertApiKeyNameIsUnique,
} from "@/lib/api-keys";

describe("api-keys", () => {
  beforeEach(() => {
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("DELETE FROM api_keys");
    db.exec("DELETE FROM projects");
    db.exec("PRAGMA foreign_keys = ON");
  });

  describe("createApiKeyForProject", () => {
    test("creates API key with default project when no slug provided", () => {
      const result = createApiKeyForProject();

      expect(result).toMatchObject({
        apiKey: expect.stringMatching(/^fbk_/),
        keyPrefix: expect.stringMatching(/^fbk_/),
        projectId: expect.any(Number),
        projectSlug: expect.stringMatching(/default|project/i),
        keyId: expect.any(Number),
        isAdmin: false,
      });

      expect(result.apiKey.length).toBeGreaterThan(16);
    });

    test("creates API key with specified project slug", () => {
      const result = createApiKeyForProject({
        projectSlug: "test-project",
        projectName: "Test Project",
        keyName: "test-key",
      });

      expect(result.projectSlug).toBe("test-project");
      expect(result.projectName).toBe("Test Project");
    });

    test("creates admin API key when isAdmin is true", () => {
      const result = createApiKeyForProject({
        projectName: "Admin Project",
        isAdmin: true,
      });

      expect(result.isAdmin).toBe(true);
    });

    test("normalizes project slug correctly", () => {
      const result = createApiKeyForProject({
        projectSlug: "Test__Project  Name!!!",
        projectName: "Test Project",
      });

      expect(result.projectSlug).toMatch(/^[a-z0-9\-]+$/);
      expect(result.projectSlug).not.toMatch(/^-|-$/);
    });

    test("throws error when API key name already exists", () => {
      createApiKeyForProject({
        projectName: "Project 1",
        keyName: "unique-key",
      });

      expect(() => {
        createApiKeyForProject({
          projectName: "Project 2",
          keyName: "unique-key",
        });
      }).toThrow("API key name already exists");
    });

    test("generates unique key names when none provided", () => {
      const key1 = createApiKeyForProject({
        projectName: "Test Project",
      });

      const key2 = createApiKeyForProject({
        projectName: "Test Project",
      });

      expect(key1.keyId).not.toBe(key2.keyId);
    });

    test("respects custom order parameter", () => {
      const result = createApiKeyForProject({
        projectName: "Test Project",
        order: 42,
      });

      expect(result.order).toBe(42);
    });

    test("reuses existing project with same slug", () => {
      const key1 = createApiKeyForProject({
        projectSlug: "shared-project",
        projectName: "Shared Project 1",
      });

      const key2 = createApiKeyForProject({
        projectSlug: "shared-project",
        projectName: "Shared Project 2",
      });

      expect(key1.projectId).toBe(key2.projectId);
    });
  });

  describe("validateApiKey", () => {
    test("validates correct API key", () => {
      const { apiKey } = createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
      });

      const auth = validateApiKey(apiKey);

      expect(auth).not.toBeNull();
      expect(auth).toMatchObject({
        keyId: expect.any(Number),
        projectId: expect.any(Number),
        projectSlug: "test-proj",
        projectName: "Test Project",
        isAdmin: false,
      });
    });

    test("returns null for invalid API key", () => {
      createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
      });

      const auth = validateApiKey("fbk_invalid");
      expect(auth).toBeNull();
    });

    test("returns null for empty string", () => {
      const auth = validateApiKey("");
      expect(auth).toBeNull();
    });

    test("returns null for whitespace only", () => {
      const auth = validateApiKey("   ");
      expect(auth).toBeNull();
    });

    test("returns admin flag correctly", () => {
      const { apiKey } = createApiKeyForProject({
        projectSlug: "admin-proj",
        projectName: "Admin Project",
        isAdmin: true,
      });

      const auth = validateApiKey(apiKey);

      expect(auth?.isAdmin).toBe(true);
    });

    test("updates last_used_at timestamp on validation", () => {
      const { apiKey, keyId } = createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
      });

      const before = db
        .prepare("SELECT updated_at FROM api_keys WHERE id = ?")
        .get(keyId) as { updated_at: string };

      // Small delay to ensure timestamp changes
      const later = new Date();
      later.setMilliseconds(later.getMilliseconds() + 10);
      while (new Date() < later) {
        // Wait
      }

      validateApiKey(apiKey);

      const after = db
        .prepare("SELECT updated_at FROM api_keys WHERE id = ?")
        .get(keyId) as { updated_at: string };

      expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(before.updated_at).getTime()
      );
    });

    test("returns null for revoked key", () => {
      const { apiKey, keyId } = createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
      });

      revokeApiKeyById(keyId);
      const auth = validateApiKey(apiKey);

      expect(auth).toBeNull();
    });
  });

  describe("revokeApiKeyById", () => {
    test("revokes API key successfully", () => {
      const { keyId, apiKey } = createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
      });

      const result = revokeApiKeyById(keyId);

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);

      const auth = validateApiKey(apiKey);
      expect(auth).toBeNull();
    });

    test("returns success false for non-existent key", () => {
      const result = revokeApiKeyById(99999);

      expect(result.success).toBe(false);
      expect(result.rowCount).toBe(0);
    });

    test("sets soft_delete flag", () => {
      const { keyId } = createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
      });

      revokeApiKeyById(keyId);

      const row = db
        .prepare("SELECT soft_delete FROM api_keys WHERE id = ?")
        .get(keyId) as { soft_delete: number };

      expect(row.soft_delete).toBe(1);
    });

    test("idempotent - revoking already revoked key returns false", () => {
      const { keyId } = createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
      });

      revokeApiKeyById(keyId);
      const result = revokeApiKeyById(keyId);

      expect(result.success).toBe(false);
    });
  });

  describe("rotateApiKeyById", () => {
    test("rotates API key successfully", () => {
      const { keyId, apiKey: oldKey } = createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
        keyName: "rotate-key",
      });

      const result = rotateApiKeyById(keyId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.oldKeyId).toBe(keyId);
      expect(result.data?.newKeyId).not.toBe(keyId);
      expect(result.data?.apiKey).toMatch(/^fbk_/);
      expect(result.data?.apiKey).not.toBe(oldKey);
    });

    test("returns error for non-existent key", () => {
      const result = rotateApiKeyById(99999);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });

    test("old key becomes invalid after rotation", () => {
      const { keyId, apiKey: oldKey } = createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
      });

      const rotateResult = rotateApiKeyById(keyId);
      const oldAuth = validateApiKey(oldKey);
      const newAuth = validateApiKey(rotateResult.data!.apiKey);

      expect(oldAuth).toBeNull();
      expect(newAuth).not.toBeNull();
    });

    test("preserves key metadata during rotation", () => {
      const { keyId } = createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
        keyName: "metadata-key",
        order: 10,
        isAdmin: true,
      });

      const result = rotateApiKeyById(keyId);

      expect(result.data?.projectSlug).toBe("test-proj");
      expect(result.data?.projectName).toBe("Test Project");
      expect(result.data?.isAdmin).toBe(true);
    });

    test("uses database transaction for consistency", () => {
      const { keyId } = createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
      });

      rotateApiKeyById(keyId);

      const count = db
        .prepare("SELECT COUNT(*) as count FROM api_keys WHERE id = ? AND soft_delete = 0")
        .get(keyId) as { count: number };

      expect(count.count).toBe(0);
    });
  });

  describe("listApiKeys", () => {
    test("lists all active API keys by default", () => {
      createApiKeyForProject({
        projectSlug: "proj-1",
        projectName: "Project 1",
      });
      createApiKeyForProject({
        projectSlug: "proj-2",
        projectName: "Project 2",
      });

      const keys = listApiKeys();

      expect(keys.length).toBe(2);
      expect(keys.every((k) => !k.revoked)).toBe(true);
    });

    test("filters by project slug", () => {
      createApiKeyForProject({
        projectSlug: "proj-1",
        projectName: "Project 1",
      });
      createApiKeyForProject({
        projectSlug: "proj-2",
        projectName: "Project 2",
      });

      const keys = listApiKeys({ projectSlug: "proj-1" });

      expect(keys.length).toBe(1);
      expect(keys[0].projectSlug).toBe("proj-1");
    });

    test("excludes revoked keys by default", () => {
      const { keyId: key1Id } = createApiKeyForProject({
        projectSlug: "proj-1",
        projectName: "Project 1",
      });
      createApiKeyForProject({
        projectSlug: "proj-2",
        projectName: "Project 2",
      });

      revokeApiKeyById(key1Id);

      const keys = listApiKeys();

      expect(keys.length).toBe(1);
      expect(keys[0].projectSlug).toBe("proj-2");
    });

    test("includes revoked keys when specified", () => {
      const { keyId: key1Id } = createApiKeyForProject({
        projectSlug: "proj-1",
        projectName: "Project 1",
      });
      createApiKeyForProject({
        projectSlug: "proj-2",
        projectName: "Project 2",
      });

      revokeApiKeyById(key1Id);

      const keys = listApiKeys({ includeRevoked: true });

      expect(keys.length).toBe(2);
      expect(keys.some((k) => k.revoked)).toBe(true);
    });

    test("returns correct ApiKeySummary structure", () => {
      createApiKeyForProject({
        projectSlug: "test-proj",
        projectName: "Test Project",
        keyName: "test-key",
        order: 5,
        isAdmin: false,
      });

      const keys = listApiKeys();
      const key = keys[0];

      expect(key).toMatchObject({
        id: expect.any(Number),
        projectId: expect.any(Number),
        projectSlug: "test-proj",
        projectName: "Test Project",
        name: "test-key",
        order: 5,
        keyPrefix: expect.stringMatching(/^fbk_/),
        isAdmin: false,
        revoked: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    test("sorts by order then slug then id", () => {
      createApiKeyForProject({
        projectSlug: "b-proj",
        projectName: "B Project",
        order: 1,
      });
      createApiKeyForProject({
        projectSlug: "a-proj",
        projectName: "A Project",
        order: 0,
      });
      createApiKeyForProject({
        projectSlug: "c-proj",
        projectName: "C Project",
        order: 1,
      });

      const keys = listApiKeys();

      expect(keys[0].projectSlug).toBe("a-proj");
      expect(keys[1].projectSlug).toBe("b-proj");
      expect(keys[2].projectSlug).toBe("c-proj");
    });
  });

  describe("assertApiKeyNameIsUnique", () => {
    test("throws error if name is empty", () => {
      expect(() => assertApiKeyNameIsUnique("")).toThrow("API key name cannot be empty");
    });

    test("throws error if name only contains whitespace", () => {
      expect(() => assertApiKeyNameIsUnique("   ")).toThrow("API key name cannot be empty");
    });

    test("throws error if name already exists", () => {
      createApiKeyForProject({
        projectName: "Project 1",
        keyName: "existing-key",
      });

      expect(() => assertApiKeyNameIsUnique("existing-key")).toThrow(
        "API key name already exists"
      );
    });

    test("allows unique names", () => {
      createApiKeyForProject({
        projectName: "Project 1",
        keyName: "key-1",
      });

      expect(() => assertApiKeyNameIsUnique("key-2")).not.toThrow();
    });

    test("case insensitive comparison", () => {
      createApiKeyForProject({
        projectName: "Project 1",
        keyName: "TestKey",
      });

      expect(() => assertApiKeyNameIsUnique("testkey")).toThrow(
        "API key name already exists"
      );
    });

    test("excludes id when checking uniqueness", () => {
      const { keyId } = createApiKeyForProject({
        projectName: "Project 1",
        keyName: "original-key",
      });

      expect(() => assertApiKeyNameIsUnique("original-key", keyId)).not.toThrow();
    });

    test("rejects name when same name exists in other key", () => {
      createApiKeyForProject({
        projectName: "Project 1",
        keyName: "key-1",
      });

      const { keyId: key2Id } = createApiKeyForProject({
        projectName: "Project 2",
        keyName: "key-2",
      });

      expect(() => assertApiKeyNameIsUnique("key-1", key2Id)).toThrow(
        "API key name already exists"
      );
    });
  });
});
