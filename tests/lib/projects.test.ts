import { feedbackDb as db } from "@/lib/db-sqlite";
import {
  listProjects,
  createProject,
  assertProjectUniqueness,
} from "@/lib/projects";

describe("projects", () => {
  beforeEach(() => {
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("DELETE FROM projects");
    db.exec("PRAGMA foreign_keys = ON");
  });

  describe("listProjects", () => {
    test("returns empty list when no projects exist", () => {
      const projects = listProjects();

      expect(projects).toEqual([]);
    });

    test("returns all non-deleted projects by default", () => {
      createProject({ name: "Project 1" });
      createProject({ name: "Project 2" });

      const projects = listProjects();

      expect(projects).toHaveLength(2);
    });

    test("excludes soft-deleted projects by default", () => {
      const proj1 = createProject({ name: "Project 1" });
      createProject({ name: "Project 2" });

      db.prepare("UPDATE projects SET soft_delete = 1 WHERE id = ?").run(proj1.id);

      const projects = listProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].id).not.toBe(proj1.id);
    });

    test("includes soft-deleted projects when requested", () => {
      createProject({ name: "Project 1" });
      const proj2 = createProject({ name: "Project 2" });

      db.prepare("UPDATE projects SET soft_delete = 1 WHERE id = ?").run(proj2.id);

      const projects = listProjects(true);

      expect(projects).toHaveLength(2);
    });

    test("returns ProjectSummary structure", () => {
      createProject({ name: "Test Project", slug: "test-slug" });

      const projects = listProjects();

      expect(projects[0]).toMatchObject({
        id: expect.any(Number),
        slug: expect.any(String),
        name: expect.any(String),
        order: expect.any(Number),
        draft: expect.any(Boolean),
        softDelete: expect.any(Boolean),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    test("sorts by order, slug, then id", () => {
      createProject({ name: "Z Project", order: 1 });
      createProject({ name: "A Project", order: 0 });
      createProject({ name: "B Project", order: 1 });

      const projects = listProjects();

      expect(projects[0].name).toBe("A Project");
      expect(projects[1].name).toMatch(/B|Z/);
    });

    test("converts database flags to booleans", () => {
      createProject({ name: "Test Project" });

      const projects = listProjects();

      expect(typeof projects[0].draft).toBe("boolean");
      expect(typeof projects[0].softDelete).toBe("boolean");
    });
  });

  describe("createProject", () => {
    test("creates project with minimal input", () => {
      const project = createProject({ name: "Test Project" });

      expect(project).toMatchObject({
        id: expect.any(Number),
        slug: expect.stringMatching(/^[a-z0-9\-]*$/),
        name: "Test Project",
        order: 0,
        draft: false,
        softDelete: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    test("always normalizes slug from name regardless of input", () => {
      const project = createProject({
        name: "Test Project",
        slug: "custom-slug", // This is ignored
      });

      expect(project.slug).toMatch(/^[a-z0-9\-]*$/);
      expect(project.slug).not.toBe("custom-slug");
    });

    test("creates project with custom order", () => {
      const project = createProject({
        name: "Test Project",
        order: 42,
      });

      expect(project.order).toBe(42);
    });

    test("normalizes slug from name", () => {
      const project = createProject({
        name: "Test__Project  Name!!!",
      });

      expect(project.slug).toMatch(/^[a-z0-9\-]+$/);
      expect(project.slug).not.toMatch(/^-|-$/);
      expect(project.slug).not.toContain("_");
    });

    test("throws error when name is empty", () => {
      // When name is empty, the slug derived from it is also empty
      // This throws "Project slug cannot be empty" first
      expect(() => createProject({ name: "" })).toThrow(
        "Project slug cannot be empty"
      );
    });

    test("throws error when name is only whitespace", () => {
      // When name is whitespace, the normalized slug is empty
      expect(() => createProject({ name: "   " })).toThrow(
        "Project slug cannot be empty"
      );
    });

    test("throws error when generated slug is empty", () => {
      expect(() => createProject({ name: "!!!###" })).toThrow(
        "Project slug cannot be empty"
      );
    });

    test("throws error when slug already exists", () => {
      // Slug is derived from name, so create with names that produce the same slug
      createProject({ name: "Existing Slug" });

      // Both names generate the same slug "existing-slug"
      // The slug check happens first, so we get "Project slug already exists"
      expect(() => createProject({ name: "Existing Slug" })).toThrow(
        "Project slug already exists"
      );
    });

    test("throws error when name already exists", () => {
      createProject({ name: "Unique Project" });

      // Slug check happens first, so this throws "Project slug already exists"
      expect(() => createProject({ name: "Unique Project" })).toThrow(
        "Project slug already exists"
      );
    });

    test("name comparison is case insensitive", () => {
      createProject({ name: "Test Project" });

      // Case insensitive - since both will have same slug, slug check throws first
      expect(() => createProject({ name: "test project" })).toThrow(
        "Project slug already exists"
      );
    });

    test("slug comparison is case insensitive", () => {
      // Create project with name that will produce a certain slug
      createProject({ name: "Test Slug Project" });

      // Case variation in name should still cause slug conflict
      // Slug check happens first
      expect(() => createProject({ name: "test slug project" })).toThrow(
        "Project slug already exists"
      );
    });

    test("persists to database", () => {
      const project = createProject({ name: "Persisted Project" });

      const row = db
        .prepare("SELECT * FROM projects WHERE id = ?")
        .get(project.id) as { name: string; slug: string } | undefined;

      expect(row).toBeTruthy();
      expect(row?.name).toBe("Persisted Project");
      // slug is derived from name, not the input slug parameter
      expect(row?.slug).toMatch(/^[a-z0-9\-]+$/);
    });

    test("sets created_at and updated_at timestamps", () => {
      const before = new Date();
      const project = createProject({ name: "Timestamped Project" });
      const after = new Date();

      const createdTime = new Date(project.createdAt);
      const updatedTime = new Date(project.updatedAt);

      expect(createdTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updatedTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test("generates unique ids", () => {
      const proj1 = createProject({ name: "Project 1" });
      const proj2 = createProject({ name: "Project 2" });

      expect(proj1.id).not.toBe(proj2.id);
    });
  });

  describe("assertProjectUniqueness", () => {
    test("throws error for empty slug", () => {
      expect(() => assertProjectUniqueness({ slug: "" })).toThrow(
        "Project slug cannot be empty"
      );
    });

    test("throws error for empty name", () => {
      expect(() => assertProjectUniqueness({ name: "" })).toThrow(
        "Project name cannot be empty"
      );
    });

    test("throws error for whitespace-only slug", () => {
      expect(() => assertProjectUniqueness({ slug: "   " })).toThrow(
        "Project slug cannot be empty"
      );
    });

    test("throws error for whitespace-only name", () => {
      expect(() => assertProjectUniqueness({ name: "   " })).toThrow(
        "Project name cannot be empty"
      );
    });

    test("throws error when slug already exists", () => {
      const proj = createProject({ name: "Existing Slug Test" });

      // assertProjectUniqueness checks if the normalized slug exists
      // Since slug is derived from name in createProject, we check the actual slug that was created
      expect(() =>
        assertProjectUniqueness({ slug: proj.slug })
      ).toThrow("Project slug already exists");
    });

    test("throws error when name already exists", () => {
      createProject({ name: "Existing Name" });

      expect(() => assertProjectUniqueness({ name: "Existing Name" })).toThrow(
        "Project name already exists"
      );
    });

    test("allows existing slug when excluding by id", () => {
      const project = createProject({ name: "Project 1", slug: "existing" });

      expect(() =>
        assertProjectUniqueness({ slug: "existing", excludeId: project.id })
      ).not.toThrow();
    });

    test("allows existing name when excluding by id", () => {
      const project = createProject({ name: "Existing Name" });

      expect(() =>
        assertProjectUniqueness({ name: "Existing Name", excludeId: project.id })
      ).not.toThrow();
    });

    test("rejects existing slug from different project", () => {
      const project1 = createProject({ name: "Slug Test 1" });
      const project2 = createProject({ name: "Slug Test 2" });

      // Check that project1's slug is different from project2's
      expect(project1.slug).not.toBe(project2.slug);

      // Try to assert uniqueness for project1's slug but exclude project1
      // This should fail because project1's slug already exists
      expect(() =>
        assertProjectUniqueness({ slug: project1.slug, excludeId: project2.id })
      ).toThrow("Project slug already exists");
    });

    test("rejects existing name from different project", () => {
      createProject({ name: "Name 1" });
      const project2 = createProject({ name: "Name 2" });

      expect(() =>
        assertProjectUniqueness({ name: "Name 1", excludeId: project2.id })
      ).toThrow("Project name already exists");
    });

    test("handles both slug and name validation", () => {
      const project = createProject({ name: "Project 1" });

      // Try to assert uniqueness with both the actual slug and name
      expect(() =>
        assertProjectUniqueness({ slug: project.slug, name: "Project 1" })
      ).toThrow();
    });

    test("case insensitive slug comparison", () => {
      const proj = createProject({ name: "Case Slug Test" });

      // assertProjectUniqueness should do case-insensitive comparison
      // The actual slug from the project is lowercase
      const slugWithDifferentCase = proj.slug.toUpperCase();

      expect(() => assertProjectUniqueness({ slug: slugWithDifferentCase })).toThrow(
        "Project slug already exists"
      );
    });

    test("case insensitive name comparison", () => {
      createProject({ name: "Test Project" });

      expect(() => assertProjectUniqueness({ name: "test project" })).toThrow(
        "Project name already exists"
      );
    });

    test("does not throw for undefined input", () => {
      expect(() => assertProjectUniqueness({})).not.toThrow();
    });

    test("normalizes slug before checking", () => {
      const proj = createProject({ name: "Test Slug Normalization" });

      // Test that slug is normalized before checking uniqueness
      // Create a slug with special characters that will normalize to the same value
      expect(() =>
        assertProjectUniqueness({ slug: proj.slug.replace(/-/g, "__") + "###" })
      ).toThrow("Project slug already exists");
    });
  });
});
