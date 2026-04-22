import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import type { NextApiRequest, NextApiResponse } from "next";

process.env.NODE_ENV = "test";
process.env.FEEDBACK_BOOTSTRAP_TOKEN = "bootstrap-test-token";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_FEEDBACK_API_URL = "http://localhost:3000";
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
  let feedbacksRoute: typeof import("@/app/api/v1/feedbacks/route");
  let feedbackMetaRoute: typeof import("@/app/api/v1/feedbacks/meta/route");
  let feedbackByIdRoute: typeof import("@/app/api/v1/feedbacks/[id]/route");
  let adminFeedbacksRoute: typeof import("@/app/api/v1/admin/feedbacks/route");
  let adminFeedbackByIdRoute: typeof import("@/app/api/v1/admin/feedbacks/[id]/route");
  let adminMessagesRoute: typeof import("@/app/api/v1/admin/feedbacks/[id]/messages/route");
  let keysRoute: typeof import("@/app/api/v1/admin/keys/route");
  let keyDeleteRoute: typeof import("@/app/api/v1/admin/keys/[id]/route");
  let keyRotateRoute: typeof import("@/app/api/v1/admin/keys/[id]/rotate/route");
  let projectsRoute: typeof import("@/app/api/v1/admin/projects/route");
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
    feedbacksRoute = await import("@/app/api/v1/feedbacks/route");
    feedbackMetaRoute = await import("@/app/api/v1/feedbacks/meta/route");
    feedbackByIdRoute = await import("@/app/api/v1/feedbacks/[id]/route");
    adminFeedbacksRoute = await import("@/app/api/v1/admin/feedbacks/route");
    adminFeedbackByIdRoute = await import("@/app/api/v1/admin/feedbacks/[id]/route");
    adminMessagesRoute = await import("@/app/api/v1/admin/feedbacks/[id]/messages/route");
    keysRoute = await import("@/app/api/v1/admin/keys/route");
    keyDeleteRoute = await import("@/app/api/v1/admin/keys/[id]/route");
    keyRotateRoute = await import("@/app/api/v1/admin/keys/[id]/rotate/route");
    projectsRoute = await import("@/app/api/v1/admin/projects/route");
    openApiRoute = await import("@/app/api/v1/openapi.json/route");
    ({ default: docsHandler } = await import("@/pages/api/v1/docs"));
  });

  beforeEach(() => {
    db.exec(`
      DELETE FROM feedback_messages;
      DELETE FROM feedbacks;
      DELETE FROM api_keys;
      DELETE FROM feedback_status;
      DELETE FROM feedback_types;
      DELETE FROM organisations;
      DELETE FROM projects WHERE slug != 'default';
      UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('feedback_status','feedback_types','organisations','feedbacks','feedback_messages','api_keys');
    `);

    db.exec(`
      INSERT INTO feedback_status (id, name, label) VALUES
      (1,'Open','Open'),(2,'In Progress','In Progress'),(3,'Pending Review','Pending Review'),
      (4,'Resolved','Resolved'),(5,'Closed','Closed'),(6,'Won''t Fix','Won''t Fix');

      INSERT INTO feedback_types (id, name, label) VALUES (1,'Bug','Bug');
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
    const spec = await openApiRes.json() as { info: { version: string } };
    expect(spec.info.version).toBeDefined();

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
        body: JSON.stringify({ slug: "project-b", name: "Project B" }),
      })
    );
    expect(createProjectRes.status).toBe(201);

    const projectsRes = await projectsRoute.GET(
      req("http://localhost/api/v1/admin/projects", {
        headers: { "x-bootstrap-token": process.env.FEEDBACK_BOOTSTRAP_TOKEN as string },
      })
    );
    expect(projectsRes.status).toBe(200);
  });

  test("feedback lifecycle endpoints", async () => {
    const createRes = await feedbacksRoute.POST(
      req("http://localhost/api/v1/feedbacks", {
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
      req("http://localhost/api/v1/feedbacks/meta", {
        headers: { "x-api-key": userApiKey },
      })
    );
    expect(metaRes.status).toBe(200);

    const detailRes = await feedbackByIdRoute.GET(
      req(`http://localhost/api/v1/feedbacks/${createdFeedbackId}?includeMessages=true`, {
        headers: { "x-api-key": userApiKey },
      }),
      { params: Promise.resolve({ id: String(createdFeedbackId) }) }
    );
    expect(detailRes.status).toBe(200);
    const detailJson = await readJson(detailRes);
    const detailData = detailJson.data as { feedback: { id: number } };
    expect(detailData.feedback.id).toBe(createdFeedbackId);

    const adminListRes = await adminFeedbacksRoute.GET(
      req("http://localhost/api/v1/admin/feedbacks", {
        headers: { "x-api-key": adminApiKey },
      })
    );
    expect(adminListRes.status).toBe(200);

    const adminDetailRes = await adminFeedbackByIdRoute.GET(
      req(`http://localhost/api/v1/admin/feedbacks/${createdFeedbackId}`, {
        headers: { "x-api-key": adminApiKey },
      }),
      { params: Promise.resolve({ id: String(createdFeedbackId) }) }
    );
    expect(adminDetailRes.status).toBe(200);

    const postMessageRes = await adminMessagesRoute.POST(
      req(`http://localhost/api/v1/admin/feedbacks/${createdFeedbackId}/messages`, {
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
      req(`http://localhost/api/v1/admin/feedbacks/${createdFeedbackId}/messages`, {
        headers: { "x-api-key": adminApiKey },
      }),
      { params: Promise.resolve({ id: String(createdFeedbackId) }) }
    );
    expect(listMessagesRes.status).toBe(200);

    const patchRes = await adminFeedbackByIdRoute.PATCH(
      req(`http://localhost/api/v1/admin/feedbacks/${createdFeedbackId}`, {
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
});
