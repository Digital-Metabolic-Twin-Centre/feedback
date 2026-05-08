import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import type { NextApiRequest, NextApiResponse } from "next";

process.env.NODE_ENV = "test";
process.env.FEEDBACK_BOOTSTRAP_TOKEN = "bootstrap-test-token";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
process.env.NEXT_PUBLIC_FEEDBACK_API_URL = "http://localhost:4001";
process.env.SQLITE_PATH = "./data/feedback-test.db";
process.env.MAIL_PROVIDER = "disabled";

const DB_FILE = path.resolve(process.cwd(), process.env.SQLITE_PATH as string);

function req(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

type MockNextApiResponse = Pick<
  NextApiResponse,
  "setHeader" | "status" | "json" | "send" | "end"
> & {
  headers: Record<string, string>;
  statusCode: number;
  body: unknown;
};

describe("Headless API endpoints", () => {
  let db: import("better-sqlite3").Database;

  let healthRoute: typeof import("@/app/api/healthcheck/route");
  let feedbackRoute: typeof import("@/app/api/v1/feedback/route");
  let feedbackMetaRoute: typeof import("@/app/api/v1/feedback/meta/route");
  let feedbackByIdRoute: typeof import("@/app/api/v1/feedback/[id]/route");
  let adminfeedbackRoute: typeof import("@/app/api/v1/admin/feedback/route");
  let adminFeedbackByIdRoute: typeof import("@/app/api/v1/admin/feedback/[id]/route");
  let adminMessagesRoute: typeof import("@/app/api/v1/admin/feedback/[id]/messages/route");
  let keysRoute: typeof import("@/app/api/v1/admin/keys/route");
  let keyDeleteRoute: typeof import("@/app/api/v1/admin/keys/[id]/route");
  let keyRotateRoute: typeof import("@/app/api/v1/admin/keys/[id]/rotate/route");
  let projectsRoute: typeof import("@/app/api/v1/admin/projects/route");
  let adminMetaRoute: typeof import("@/app/api/v1/admin/meta/[resource]/route");
  let adminMetaByIdRoute: typeof import("@/app/api/v1/admin/meta/[resource]/[id]/route");
  let openApiRoute: typeof import("@/app/api/v1/openapi.json/route");
  let docsHandler: typeof import("@/pages/api/v1/docs").default;

  let createApiKeyForProject: typeof import("@/lib/api-keys").createApiKeyForProject;

  let userApiKey = "";
  let adminApiKey = "";
  let createdFeedbackId = 0;

  beforeAll(async () => {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);

    jest.resetModules();

    const dbModule = await import("@/lib/db-sqlite");
    db = dbModule.feedbackDb;

    ({ createApiKeyForProject } = await import("@/lib/api-keys"));

    healthRoute = await import("@/app/api/healthcheck/route");
    feedbackRoute = await import("@/app/api/v1/feedback/route");
    feedbackMetaRoute = await import("@/app/api/v1/feedback/meta/route");
    feedbackByIdRoute = await import("@/app/api/v1/feedback/[id]/route");
    adminfeedbackRoute = await import("@/app/api/v1/admin/feedback/route");
    adminFeedbackByIdRoute = await import("@/app/api/v1/admin/feedback/[id]/route");
    adminMessagesRoute = await import("@/app/api/v1/admin/feedback/[id]/messages/route");
    keysRoute = await import("@/app/api/v1/admin/keys/route");
    keyDeleteRoute = await import("@/app/api/v1/admin/keys/[id]/route");
    keyRotateRoute = await import("@/app/api/v1/admin/keys/[id]/rotate/route");
    projectsRoute = await import("@/app/api/v1/admin/projects/route");
    adminMetaRoute = await import("@/app/api/v1/admin/meta/[resource]/route");
    adminMetaByIdRoute = await import("@/app/api/v1/admin/meta/[resource]/[id]/route");
    openApiRoute = await import("@/app/api/v1/openapi.json/route");
    ({ default: docsHandler } = await import("@/pages/api/v1/docs"));
  });

  beforeEach(() => {
    db.exec(`
      DELETE FROM feedback_messages;
      DELETE FROM feedback;
      DELETE FROM api_keys;
      DELETE FROM feedback_status;
      DELETE FROM feedback_types;
      DELETE FROM organisations;
      DELETE FROM projects WHERE slug != 'default';
      UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('feedback_status','feedback_types','organisations','feedback','feedback_messages','api_keys');
    `);

    db.exec(`
      INSERT INTO feedback_status (id, name, label) VALUES
      (1,'Open','Open'),(2,'In Progress','In Progress'),(3,'Pending Review','Pending Review'),
      (4,'Resolved','Resolved'),(15,'Closed','Closed'),(16,'Won''t Fix','Won''t Fix');

      INSERT INTO feedback_types (id, name, label) VALUES
      (1,'Bug','Bug'),(2,'Feature','Feature');
      INSERT INTO organisations (id, name, label) VALUES (1,'General','General');
    `);

    userApiKey = createApiKeyForProject({ projectSlug: "default", keyName: "user", isAdmin: false }).apiKey;
    adminApiKey = createApiKeyForProject({ projectSlug: "default", keyName: "admin", isAdmin: true }).apiKey;
    createdFeedbackId = 0;
  });

  afterAll(() => {
    db.close();
    if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
  });

  test("healthcheck GET and HEAD", async () => {
    const getRes = await healthRoute.GET();
    expect(getRes.status).toBe(200);
    expect(await getRes.json()).toEqual({ status: "ok" });

    const headRes = await healthRoute.HEAD();
    expect(headRes.status).toBe(200);
  });

  test("openapi and docs endpoints", async () => {
    const openApiRes = await openApiRoute.GET();
    expect(openApiRes.status).toBe(200);
    const spec = await openApiRes.json() as {
      info: { version: string };
      tags?: Array<{ name: string }>;
      paths: {
        "/api/v1/feedback/{id}": {
          get: { parameters?: Array<{ name: string; in: string }>; tags?: string[] };
        };
        "/api/v1/feedback/meta": {
          get: { parameters?: Array<{ name: string; in: string }>; tags?: string[] };
        };
        "/api/v1/admin/feedback": {
          get: { tags?: string[] };
        };
        "/api/v1/admin/keys": {
          get: { tags?: string[] };
        };
        "/api/v1/admin/meta/{resource}": {
          get: { tags?: string[] };
        };
        "/api/v1/openapi.json": {
          get: { tags?: string[] };
        };
      };
    };
    expect(spec.info.version).toBeDefined();
    expect(spec.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Feedback" }),
        expect.objectContaining({ name: "Admin Feedback" }),
        expect.objectContaining({ name: "Bootstrap Admin" }),
        expect.objectContaining({ name: "Documentation" }),
      ])
    );
    expect(spec.paths["/api/v1/feedback/{id}"].get.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "x-api-key", in: "header" })])
    );
    expect(spec.paths["/api/v1/feedback/{id}"].get.tags).toEqual(["Feedback"]);
    expect(spec.paths["/api/v1/feedback/meta"].get.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "x-api-key", in: "header" })])
    );
    expect(spec.paths["/api/v1/feedback/meta"].get.tags).toEqual(["Feedback"]);
    expect(spec.paths["/api/v1/admin/feedback"].get.tags).toEqual(["Admin Feedback"]);
    expect(
      (
        spec.paths["/api/v1/admin/feedback/{id}"] as {
          patch?: {
            requestBody?: {
              content?: {
                "application/json"?: {
                  schema?: {
                    properties?: {
                      action?: { enum?: string[] };
                    };
                  };
                };
              };
            };
          };
        }
      ).patch?.requestBody?.content?.["application/json"]?.schema?.properties?.action?.enum
    ).toEqual(expect.arrayContaining(["type", "status", "promote", "draft"]));
    expect(spec.paths["/api/v1/admin/keys"].get.tags).toEqual(["Bootstrap Admin"]);
    expect(spec.paths["/api/v1/admin/meta/{resource}"].get.tags).toEqual(["Bootstrap Admin"]);
    expect(spec.paths["/api/v1/openapi.json"].get.tags).toEqual(["Documentation"]);

    const res: MockNextApiResponse = {
      headers: {},
      statusCode: 0,
      body: "",
      setHeader(k: string, v: string) { this.headers[k] = v; },
      status(code: number) { this.statusCode = code; return this; },
      json(payload: unknown) { this.body = payload; return this; },
      send(payload: string) { this.body = payload; return this; },
      end() { return this; },
    };

    const docsReq = { method: "GET" } as NextApiRequest;
    docsHandler(docsReq, res);
    expect(res.statusCode).toBe(200);
    expect(String(res.body)).toContain("SwaggerUIBundle");
    expect(String(res.body)).toContain("const tagOrder = ['Feedback', 'Admin Feedback', 'Bootstrap Admin', 'Documentation'];");
  });

  test("bootstrap-protected keys and projects routes", async () => {
    const unauthorized = await keysRoute.GET(req("http://localhost/api/v1/admin/keys"));
    expect(unauthorized.status).toBe(403);

    const listRes = await keysRoute.GET(
      req("http://localhost/api/v1/admin/keys?includeRevoked=true", {
        headers: { "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string },
      })
    );
    expect(listRes.status).toBe(200);
    const listJson = await readJson(listRes);
    expect(Array.isArray(listJson.data)).toBe(true);

    const createProjectRes = await projectsRoute.POST(
      req("http://localhost/api/v1/admin/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string,
        },
        body: JSON.stringify({ slug: "should-be-ignored", name: "Project B", order: 20 }),
      })
    );
    expect(createProjectRes.status).toBe(201);
    const createProjectJson = await readJson(createProjectRes);
    expect((createProjectJson.data as { slug: string }).slug).toBe("project-b");
    expect((createProjectJson.data as { order: number }).order).toBe(20);

    const projectsRes = await projectsRoute.GET(
      req("http://localhost/api/v1/admin/projects", {
        headers: { "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string },
      })
    );
    expect(projectsRes.status).toBe(200);
  });

  test("bootstrap-protected meta CRUD routes", async () => {
    const headers = { "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string };

    const listStatusesRes = await adminMetaRoute.GET(
      req("http://localhost/api/v1/admin/meta/feedback_status", { headers }),
      { params: Promise.resolve({ resource: "feedback_status" }) }
    );
    expect(listStatusesRes.status).toBe(200);
    const listStatusesJson = await readJson(listStatusesRes);
    expect(Array.isArray(listStatusesJson.data)).toBe(true);

    const createStatusRes = await adminMetaRoute.POST(
      req("http://localhost/api/v1/admin/meta/feedback_status", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ name: "Escalated", label: "Escalated", order: 30, createdBy: "tester" }),
      }),
      { params: Promise.resolve({ resource: "feedback_status" }) }
    );
    expect(createStatusRes.status).toBe(201);
    const createStatusJson = await readJson(createStatusRes);
    const createdStatus = createStatusJson.data as { id: number; name: string; order: number };
    expect(createdStatus.name).toBe("Escalated");
    expect(createdStatus.order).toBe(30);

    const getStatusRes = await adminMetaByIdRoute.GET(
      req(`http://localhost/api/v1/admin/meta/feedback_status/${createdStatus.id}`, { headers }),
      { params: Promise.resolve({ resource: "feedback_status", id: String(createdStatus.id) }) }
    );
    expect(getStatusRes.status).toBe(200);

    const updateStatusRes = await adminMetaByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/meta/feedback_status/${createdStatus.id}`, {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ label: "Escalated Review", draft: true, order: 10 }),
      }),
      { params: Promise.resolve({ resource: "feedback_status", id: String(createdStatus.id) }) }
    );
    expect(updateStatusRes.status).toBe(200);
    const updateStatusJson = await readJson(updateStatusRes);
    const updatedStatus = updateStatusJson.data as { label: string; draft: boolean; order: number };
    expect(updatedStatus.label).toBe("Escalated Review");
    expect(updatedStatus.draft).toBe(true);
    expect(updatedStatus.order).toBe(10);

    const createOrganisationRes = await adminMetaRoute.POST(
      req("http://localhost/api/v1/admin/meta/organisations", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ name: "Acme", label: "Acme Org", country: "IE" }),
      }),
      { params: Promise.resolve({ resource: "organisations" }) }
    );
    expect(createOrganisationRes.status).toBe(201);
    const createOrganisationJson = await readJson(createOrganisationRes);
    const createdOrganisation = createOrganisationJson.data as { id: number; country: string };
    expect(createdOrganisation.country).toBe("IE");

    const updateOrganisationRes = await adminMetaByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/meta/organisations/${createdOrganisation.id}`, {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ country: "GB", softDelete: false }),
      }),
      { params: Promise.resolve({ resource: "organisations", id: String(createdOrganisation.id) }) }
    );
    expect(updateOrganisationRes.status).toBe(200);
    const updateOrganisationJson = await readJson(updateOrganisationRes);
    const updatedOrganisation = updateOrganisationJson.data as { country: string };
    expect(updatedOrganisation.country).toBe("GB");

    const createProjectRes = await adminMetaRoute.POST(
      req("http://localhost/api/v1/admin/meta/projects", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ name: "Meta Project", order: 40 }),
      }),
      { params: Promise.resolve({ resource: "projects" }) }
    );
    expect(createProjectRes.status).toBe(201);
    const createProjectJson = await readJson(createProjectRes);
    const createdProject = createProjectJson.data as { id: number; slug: string; order: number };
    expect(createdProject.slug).toBe("meta-project");
    expect(createdProject.order).toBe(40);

    const updateProjectRes = await adminMetaByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/meta/projects/${createdProject.id}`, {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ name: "Meta Project Updated", draft: true, order: 5 }),
      }),
      { params: Promise.resolve({ resource: "projects", id: String(createdProject.id) }) }
    );
    expect(updateProjectRes.status).toBe(200);
    const updateProjectJson = await readJson(updateProjectRes);
    const updatedProject = updateProjectJson.data as { name: string; draft: boolean; order: number };
    expect(updatedProject.name).toBe("Meta Project Updated");
    expect(updatedProject.draft).toBe(true);
    expect(updatedProject.order).toBe(5);

    const createKeyRes = await adminMetaRoute.POST(
      req("http://localhost/api/v1/admin/meta/api_keys", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ projectSlug: "meta-project", keyName: "meta-key", order: 12, isAdmin: false }),
      }),
      { params: Promise.resolve({ resource: "api_keys" }) }
    );
    expect(createKeyRes.status).toBe(201);
    const createKeyJson = await readJson(createKeyRes);
    const createdKey = createKeyJson.data as { keyId: number; apiKey: string; order: number };
    expect(createdKey.apiKey.startsWith("fbk_")).toBe(true);
    expect(createdKey.order).toBe(12);

    const getKeyRes = await adminMetaByIdRoute.GET(
      req(`http://localhost/api/v1/admin/meta/api_keys/${createdKey.keyId}`, { headers }),
      { params: Promise.resolve({ resource: "api_keys", id: String(createdKey.keyId) }) }
    );
    expect(getKeyRes.status).toBe(200);

    const updateKeyRes = await adminMetaByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/meta/api_keys/${createdKey.keyId}`, {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ name: "meta-key-updated", order: 2, isAdmin: true }),
      }),
      { params: Promise.resolve({ resource: "api_keys", id: String(createdKey.keyId) }) }
    );
    expect(updateKeyRes.status).toBe(200);
    const updateKeyJson = await readJson(updateKeyRes);
    const updatedKey = updateKeyJson.data as { name: string; isAdmin: boolean; order: number };
    expect(updatedKey.name).toBe("meta-key-updated");
    expect(updatedKey.isAdmin).toBe(true);
    expect(updatedKey.order).toBe(2);

    const deleteKeyRes = await adminMetaByIdRoute.DELETE(
      req(`http://localhost/api/v1/admin/meta/api_keys/${createdKey.keyId}`, {
        method: "DELETE",
        headers,
      }),
      { params: Promise.resolve({ resource: "api_keys", id: String(createdKey.keyId) }) }
    );
    expect(deleteKeyRes.status).toBe(200);

    const deleteProjectRes = await adminMetaByIdRoute.DELETE(
      req(`http://localhost/api/v1/admin/meta/projects/${createdProject.id}`, {
        method: "DELETE",
        headers,
      }),
      { params: Promise.resolve({ resource: "projects", id: String(createdProject.id) }) }
    );
    expect(deleteProjectRes.status).toBe(200);
  });

  test("feedback lifecycle endpoints", async () => {
    const createRes = await feedbackRoute.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": userApiKey,
        },
        body: JSON.stringify({
          email: "user@example.com",
          organisation: 1,
          feedback_type: 1,
          feedback_status: 1,
          page: "/home",
          initial_message: "Initial report",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await readJson(createRes);
    createdFeedbackId = created.id as number;
    expect(createdFeedbackId).toBeGreaterThan(0);

    const metaRes = await feedbackMetaRoute.GET(
      req("http://localhost/api/v1/feedback/meta", {
        headers: { "x-api-key": userApiKey },
      })
    );
    expect(metaRes.status).toBe(200);

    const detailRes = await feedbackByIdRoute.GET(
      req(`http://localhost/api/v1/feedback/${createdFeedbackId}?includeMessages=true`, {
        headers: { "x-api-key": userApiKey },
      }),
      { params: Promise.resolve({ id: String(createdFeedbackId) }) }
    );
    expect(detailRes.status).toBe(200);
    const detailJson = await readJson(detailRes);
    const detailData = detailJson.data as { feedback: { id: number } };
    expect(detailData.feedback.id).toBe(createdFeedbackId);

    const userReplyRes = await feedbackByIdRoute.POST(
      req(`http://localhost/api/v1/feedback/${createdFeedbackId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": userApiKey,
        },
        body: JSON.stringify({ message: "I have more details to add." }),
      }),
      { params: Promise.resolve({ id: String(createdFeedbackId) }) }
    );
    expect(userReplyRes.status).toBe(201);
    const userReplyJson = await readJson(userReplyRes);
    const userReplyData = userReplyJson.data as Array<{ author_role: string; message: string }>;
    expect(userReplyData).toEqual(
      expect.arrayContaining([expect.objectContaining({ author_role: "User", message: "I have more details to add." })])
    );

    const adminListRes = await adminfeedbackRoute.GET(
      req("http://localhost/api/v1/admin/feedback", {
        headers: { "x-api-key": adminApiKey },
      })
    );
    expect(adminListRes.status).toBe(200);

    const adminDetailRes = await adminFeedbackByIdRoute.GET(
      req(`http://localhost/api/v1/admin/feedback/${createdFeedbackId}`, {
        headers: { "x-api-key": adminApiKey },
      }),
      { params: Promise.resolve({ id: String(createdFeedbackId) }) }
    );
    expect(adminDetailRes.status).toBe(200);

    const postMessageRes = await adminMessagesRoute.POST(
      req(`http://localhost/api/v1/admin/feedback/${createdFeedbackId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ message: "Thanks, we are investigating." }),
      }),
      { params: Promise.resolve({ id: String(createdFeedbackId) }) }
    );
    expect(postMessageRes.status).toBe(201);

    const listMessagesRes = await adminMessagesRoute.GET(
      req(`http://localhost/api/v1/admin/feedback/${createdFeedbackId}/messages`, {
        headers: { "x-api-key": adminApiKey },
      }),
      { params: Promise.resolve({ id: String(createdFeedbackId) }) }
    );
    expect(listMessagesRes.status).toBe(200);

    const patchRes = await adminFeedbackByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/feedback/${createdFeedbackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ action: "status", value: 2 }),
      }),
      { params: Promise.resolve({ id: String(createdFeedbackId) }) }
    );
    expect(patchRes.status).toBe(200);
  });

  test("auth and validation guards reject invalid access patterns", async () => {
    const invalidKeyRes = await feedbackRoute.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "fbk_invalid",
        },
        body: JSON.stringify({ email: "user@example.com" }),
      })
    );
    expect(invalidKeyRes.status).toBe(401);

    const nonAdminListRes = await adminfeedbackRoute.GET(
      req("http://localhost/api/v1/admin/feedback", {
        headers: { "x-api-key": userApiKey },
      })
    );
    expect(nonAdminListRes.status).toBe(403);

    const invalidBootstrapMetaResourceRes = await adminMetaRoute.GET(
      req("http://localhost/api/v1/admin/meta/unknown", {
        headers: { "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string },
      }),
      { params: Promise.resolve({ resource: "unknown" }) }
    );
    expect(invalidBootstrapMetaResourceRes.status).toBe(404);

    const invalidMetaIdRes = await adminMetaByIdRoute.GET(
      req("http://localhost/api/v1/admin/meta/projects/not-a-number", {
        headers: { "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string },
      }),
      { params: Promise.resolve({ resource: "projects", id: "not-a-number" }) }
    );
    expect(invalidMetaIdRes.status).toBe(400);

    const invalidFeedbackIdRes = await feedbackByIdRoute.GET(
      req("http://localhost/api/v1/feedback/not-a-number", {
        headers: { "x-api-key": userApiKey },
      }),
      { params: Promise.resolve({ id: "not-a-number" }) }
    );
    expect(invalidFeedbackIdRes.status).toBe(400);
  });

  test("closed feedback blocks new replies and detail route toggles includeMessages", async () => {
    const createRes = await feedbackRoute.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": userApiKey,
        },
        body: JSON.stringify({
          email: "closed@example.com",
          organisation: 1,
          feedback_type: 1,
          feedback_status: 1,
          page: "/closed",
          initial_message: "Please close this.",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await readJson(createRes);
    const feedbackId = created.id as number;

    const detailWithoutMessagesRes = await feedbackByIdRoute.GET(
      req(`http://localhost/api/v1/feedback/${feedbackId}`, {
        headers: { "x-api-key": userApiKey },
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(detailWithoutMessagesRes.status).toBe(200);
    const detailWithoutMessagesJson = await readJson(detailWithoutMessagesRes);
    expect((detailWithoutMessagesJson.data as Record<string, unknown>).messages).toBeUndefined();

    const closeRes = await adminFeedbackByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ action: "close" }),
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(closeRes.status).toBe(200);

    const userReplyRes = await feedbackByIdRoute.POST(
      req(`http://localhost/api/v1/feedback/${feedbackId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": userApiKey,
        },
        body: JSON.stringify({ message: "Can I still reply?" }),
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(userReplyRes.status).toBe(409);

    const adminReplyRes = await adminMessagesRoute.POST(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ message: "Admin should also be blocked." }),
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(adminReplyRes.status).toBe(409);
  });

  test("admin feedback patch accepts type, status, promote, and draft actions", async () => {
    const createRes = await feedbackRoute.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": userApiKey,
        },
        body: JSON.stringify({
          email: "patchable@example.com",
          organisation: 1,
          feedback_type: 1,
          feedback_status: 1,
          page: "/patchable",
          initial_message: "Patch me.",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await readJson(createRes);
    const feedbackId = created.id as number;

    const typeRes = await adminFeedbackByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ action: "type", value: "Feature" }),
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(typeRes.status).toBe(200);

    const statusRes = await adminFeedbackByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ action: "status", value: "In Progress" }),
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(statusRes.status).toBe(200);

    const promoteRes = await adminFeedbackByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ action: "promote", value: true }),
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(promoteRes.status).toBe(200);

    const draftRes = await adminFeedbackByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ action: "draft", value: true }),
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(draftRes.status).toBe(200);

    const detailRes = await adminFeedbackByIdRoute.GET(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        headers: { "x-api-key": adminApiKey },
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(detailRes.status).toBe(200);
    const detailJson = await readJson(detailRes);
    const data = detailJson.data as {
      feedback_type: number;
      feedback_status: number;
      promote: boolean;
      draft: boolean;
    };

    expect(data.feedback_type).toBe(2);
    expect(data.feedback_status).toBe(2);
    expect(data.promote).toBe(true);
    expect(data.draft).toBe(true);
  });

  test("promote action requires an explicit boolean value", async () => {
    const createRes = await feedbackRoute.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": userApiKey,
        },
        body: JSON.stringify({
          email: "promote-validation@example.com",
          organisation: 1,
          feedback_type: 1,
          feedback_status: 1,
          page: "/promote-validation",
          initial_message: "Validate promote.",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await readJson(createRes);
    const feedbackId = created.id as number;

    const patchRes = await adminFeedbackByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ action: "promote" }),
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );

    expect(patchRes.status).toBe(400);
    await expect(readJson(patchRes)).resolves.toMatchObject({
      success: false,
      error: "Invalid promote value",
    });
  });

  test("close and wontfix actions resolve feedback status from the database", async () => {
    const createRes = await feedbackRoute.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": userApiKey,
        },
        body: JSON.stringify({
          email: "status-actions@example.com",
          organisation: 1,
          feedback_type: 1,
          feedback_status: 1,
          page: "/status-actions",
          initial_message: "Status transitions.",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await readJson(createRes);
    const feedbackId = created.id as number;

    const closeRes = await adminFeedbackByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ action: "close" }),
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(closeRes.status).toBe(200);

    let detailRes = await adminFeedbackByIdRoute.GET(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        headers: { "x-api-key": adminApiKey },
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(detailRes.status).toBe(200);
    let detailJson = await readJson(detailRes);
    expect((detailJson.data as { feedback_status: number }).feedback_status).toBe(15);

    const wontFixRes = await adminFeedbackByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-api-key": adminApiKey,
        },
        body: JSON.stringify({ action: "wontfix" }),
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(wontFixRes.status).toBe(200);

    detailRes = await adminFeedbackByIdRoute.GET(
      req(`http://localhost/api/v1/admin/feedback/${feedbackId}`, {
        headers: { "x-api-key": adminApiKey },
      }),
      { params: Promise.resolve({ id: String(feedbackId) }) }
    );
    expect(detailRes.status).toBe(200);
    detailJson = await readJson(detailRes);
    expect((detailJson.data as { feedback_status: number }).feedback_status).toBe(16);
  });

  test("order fields control sorting for projects and feedback metadata", async () => {
    const bootstrapHeaders = {
      "content-type": "application/json",
      "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string,
    };

    const lowProjectRes = await projectsRoute.POST(
      req("http://localhost/api/v1/admin/projects", {
        method: "POST",
        headers: bootstrapHeaders,
        body: JSON.stringify({ slug: "ignored-low", name: "Sort Low", order: 1 }),
      })
    );
    expect(lowProjectRes.status).toBe(201);

    const highProjectRes = await projectsRoute.POST(
      req("http://localhost/api/v1/admin/projects", {
        method: "POST",
        headers: bootstrapHeaders,
        body: JSON.stringify({ slug: "ignored-high", name: "Sort High", order: 99 }),
      })
    );
    expect(highProjectRes.status).toBe(201);

    const projectsRes = await projectsRoute.GET(
      req("http://localhost/api/v1/admin/projects?includeArchived=true", {
        headers: { "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string },
      })
    );
    expect(projectsRes.status).toBe(200);
    const projectsJson = await readJson(projectsRes);
    const projectData = projectsJson.data as Array<{ slug: string; order: number }>;
    const sortLowIndex = projectData.findIndex((row) => row.slug === "sort-low");
    const sortHighIndex = projectData.findIndex((row) => row.slug === "sort-high");
    expect(sortLowIndex).toBeGreaterThanOrEqual(0);
    expect(sortHighIndex).toBeGreaterThanOrEqual(0);
    expect(sortLowIndex).toBeLessThan(sortHighIndex);

    const lowStatusRes = await adminMetaRoute.POST(
      req("http://localhost/api/v1/admin/meta/feedback_status", {
        method: "POST",
        headers: bootstrapHeaders,
        body: JSON.stringify({ name: "Sort First", label: "Sort First", order: 1 }),
      }),
      { params: Promise.resolve({ resource: "feedback_status" }) }
    );
    expect(lowStatusRes.status).toBe(201);

    const highStatusRes = await adminMetaRoute.POST(
      req("http://localhost/api/v1/admin/meta/feedback_status", {
        method: "POST",
        headers: bootstrapHeaders,
        body: JSON.stringify({ name: "Sort Last", label: "Sort Last", order: 99 }),
      }),
      { params: Promise.resolve({ resource: "feedback_status" }) }
    );
    expect(highStatusRes.status).toBe(201);

    const feedbackMetaRes = await feedbackMetaRoute.GET(
      req("http://localhost/api/v1/feedback/meta", {
        headers: { "x-api-key": userApiKey },
      })
    );
    expect(feedbackMetaRes.status).toBe(200);
    const feedbackMetaJson = await readJson(feedbackMetaRes);
    const statuses = (feedbackMetaJson as { statuses: Array<{ name: string; order: number }> }).statuses;
    const firstIndex = statuses.findIndex((row) => row.name === "Sort First");
    const lastIndex = statuses.findIndex((row) => row.name === "Sort Last");
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(lastIndex).toBeGreaterThanOrEqual(0);
    expect(firstIndex).toBeLessThan(lastIndex);
  });

  test("key rotate and revoke", async () => {
    const keyCreateRes = await keysRoute.POST(
      req("http://localhost/api/v1/admin/keys", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string,
        },
        body: JSON.stringify({ projectSlug: "default", keyName: "rotate-me", isAdmin: false }),
      })
    );
    expect(keyCreateRes.status).toBe(201);
    const keyCreateJson = await readJson(keyCreateRes);
    const createdKeyData = keyCreateJson.data as { keyId: number };
    const keyId = createdKeyData.keyId;

    const rotateRes = await keyRotateRoute.POST(
      req(`http://localhost/api/v1/admin/keys/${keyId}/rotate`, {
        method: "POST",
        headers: { "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string },
      }),
      { params: Promise.resolve({ id: String(keyId) }) }
    );
    expect(rotateRes.status).toBe(201);

    const rotateJson = await readJson(rotateRes);
    const rotateData = rotateJson.data as { newKeyId: number };
    const newKeyId = rotateData.newKeyId;

    const deleteRes = await keyDeleteRoute.DELETE(
      req(`http://localhost/api/v1/admin/keys/${newKeyId}`, {
        method: "DELETE",
        headers: { "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string },
      }),
      { params: Promise.resolve({ id: String(newKeyId) }) }
    );
    expect(deleteRes.status).toBe(200);
  });

  test("key creation uses the first active project when projectSlug is omitted", async () => {
    db.exec(`
      DELETE FROM api_keys;
      DELETE FROM projects;
      INSERT INTO projects (slug, name) VALUES ('alpha', 'Alpha Project');
      INSERT INTO projects (slug, name) VALUES ('beta', 'Beta Project');
    `);

    const keyCreateRes = await keysRoute.POST(
      req("http://localhost/api/v1/admin/keys", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string,
        },
        body: JSON.stringify({ keyName: "first-project-key", isAdmin: true }),
      })
    );

    expect(keyCreateRes.status).toBe(201);
    const keyCreateJson = await readJson(keyCreateRes);
    const createdKeyData = keyCreateJson.data as {
      projectSlug: string;
      projectName: string;
      isAdmin: boolean;
    };

    expect(createdKeyData.projectSlug).toBe("alpha");
    expect(createdKeyData.projectName).toBe("Alpha Project");
    expect(createdKeyData.isAdmin).toBe(true);
  });

  test("bootstrap meta and project uniqueness rules are enforced", async () => {
    const headers = {
      "content-type": "application/json",
      "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string,
    };

    const ignoredSlugRes = await projectsRoute.POST(
      req("http://localhost/api/v1/admin/projects", {
        method: "POST",
        headers,
        body: JSON.stringify({ slug: "manually-supplied-slug", name: "Slug From Name Project" }),
      })
    );
    expect(ignoredSlugRes.status).toBe(201);
    const ignoredSlugJson = await readJson(ignoredSlugRes);
    expect((ignoredSlugJson.data as { slug: string }).slug).toBe("slug-from-name-project");

    const createUniqueProjectRes = await projectsRoute.POST(
      req("http://localhost/api/v1/admin/projects", {
        method: "POST",
        headers,
        body: JSON.stringify({ slug: "ignored-unique-project", name: "Uniqueness Project" }),
      })
    );
    expect(createUniqueProjectRes.status).toBe(201);
    const createUniqueProjectJson = await readJson(createUniqueProjectRes);
    expect((createUniqueProjectJson.data as { slug: string }).slug).toBe("uniqueness-project");

    const duplicateNameRes = await projectsRoute.POST(
      req("http://localhost/api/v1/admin/projects", {
        method: "POST",
        headers,
        body: JSON.stringify({ slug: "another-ignored-slug", name: "Uniqueness Project" }),
      })
    );
    expect(duplicateNameRes.status).toBe(409);

    const duplicateStatusNameRes = await adminMetaRoute.POST(
      req("http://localhost/api/v1/admin/meta/feedback_status", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Open", label: "Open Copy" }),
      }),
      { params: Promise.resolve({ resource: "feedback_status" }) }
    );
    expect(duplicateStatusNameRes.status).toBe(409);

    const duplicateApiKeyNameRes = await keysRoute.POST(
      req("http://localhost/api/v1/admin/keys", {
        method: "POST",
        headers,
        body: JSON.stringify({ projectSlug: "default", keyName: "admin", isAdmin: false }),
      })
    );
    expect(duplicateApiKeyNameRes.status).toBe(409);

    const createOrganisationRes = await adminMetaRoute.POST(
      req("http://localhost/api/v1/admin/meta/organisations", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Unique Org", label: "Unique Org" }),
      }),
      { params: Promise.resolve({ resource: "organisations" }) }
    );
    expect(createOrganisationRes.status).toBe(201);
    const createOrganisationJson = await readJson(createOrganisationRes);
    const createdOrganisation = createOrganisationJson.data as { id: number };

    const duplicateOrganisationNameRes = await adminMetaByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/meta/organisations/${createdOrganisation.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "General" }),
      }),
      { params: Promise.resolve({ resource: "organisations", id: String(createdOrganisation.id) }) }
    );
    expect(duplicateOrganisationNameRes.status).toBe(409);

    const duplicateApiKeyMetaNameRes = await adminMetaByIdRoute.PATCH(
      req("http://localhost/api/v1/admin/meta/api_keys/2", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "user" }),
      }),
      { params: Promise.resolve({ resource: "api_keys", id: "2" }) }
    );
    expect(duplicateApiKeyMetaNameRes.status).toBe(409);
  });
});
