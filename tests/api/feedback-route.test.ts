import { NextRequest } from "next/server";

function req(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

describe("feedback route", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("OPTIONS returns preflight response", async () => {
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn(),
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn(),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.OPTIONS();
    expect(response.status).toBe(204);
  });

  test("POST returns auth failure response when API key is invalid", async () => {
    const authFailure = Response.json({ success: false, error: "Invalid or missing API key." }, { status: 401 });
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn(),
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({ ok: false, response: authFailure }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.POST(
      req("http://localhost/api/v1/feedback", { method: "POST", body: JSON.stringify({ email: "x@y.com" }) })
    );
    expect(response.status).toBe(401);
  });

  test("POST returns 400 for invalid payload and handles malformed JSON body", async () => {
    const insertFeedback = jest.fn();
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback,
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 8, projectSlug: "default", projectName: "Default", keyId: 1, isAdmin: false },
      }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      })
    );

    expect(response.status).toBe(400);
    expect(insertFeedback).not.toHaveBeenCalled();
  });

  test("POST returns 400 for empty initial_message", async () => {
    const insertFeedback = jest.fn().mockReturnValue({ insertedId: 77 });
    const insertThreadMessage = jest.fn();
    const notifyfeedbackubmitted = jest.fn().mockResolvedValue(undefined);

    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback,
      insertThreadMessage,
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted,
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 5, projectSlug: "proj", projectName: "Project", keyId: 1, isAdmin: false },
      }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          initial_message: "   ",
          draft: false,
          promote: false,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(insertFeedback).not.toHaveBeenCalled();
    expect(insertThreadMessage).not.toHaveBeenCalled();
    expect(notifyfeedbackubmitted).not.toHaveBeenCalled();
  });

  test("POST inserts initial thread message and absorbs notification promise rejection", async () => {
    const insertFeedback = jest.fn().mockReturnValue({ insertedId: 88 });
    const insertThreadMessage = jest.fn();
    const notifyfeedbackubmitted = jest.fn().mockRejectedValue(new Error("mail down"));

    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback,
      insertThreadMessage,
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted,
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 5, projectSlug: "proj", projectName: "Project", keyId: 1, isAdmin: false },
      }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          initial_message: "Created from portal",
          draft: false,
          promote: false,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(insertThreadMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        feedbackId: 88,
        authorRole: "User",
        message: "Created from portal",
        createdBy: "user@example.com",
      })
    );
    await Promise.resolve();
  });

  test("POST returns 502 when promotion sync fails with PlatformSyncError", async () => {
    const insertFeedback = jest.fn().mockReturnValue({ insertedId: 123 });
     class PlatformSyncError extends Error {
      failures: unknown[];
      partialResults: unknown[];

      constructor(message: string, failures: unknown[], partialResults: unknown[]) {
        super(message);
        this.failures = failures;
        this.partialResults = partialResults;
      }
    }

    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback,
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError,
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(() => {
        throw new PlatformSyncError("Sync failed", [{ platform: "github" }], [{ platform: "gitlab" }]);
      }),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 9, projectSlug: "default", projectName: "Default", keyId: 1, isAdmin: false },
      }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "promote@example.com",
          initial_message: "Please promote this",
          promote: true,
          draft: false,
        }),
      })
    );

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: "Sync failed",
      })
    );
  });

  test("POST returns 500 for generic non-sync errors", async () => {
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn(() => {
        throw new Error("insert failed");
      }),
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 5, projectSlug: "proj", projectName: "Project", keyId: 1, isAdmin: false },
      }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", initial_message: "Created from portal" }),
      })
    );

    expect(response.status).toBe(500);
  });

  test("POST returns fallback internal error message for non-Error throws", async () => {
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn(() => {
        throw "boom";
      }),
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 5, projectSlug: "proj", projectName: "Project", keyId: 1, isAdmin: false },
      }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", initial_message: "Created from portal", draft: true }),
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(
      expect.objectContaining({ success: false, error: "Internal server error" })
    );
  });

  test("POST skips notifications for draft feedback", async () => {
    const notifyfeedbackubmitted = jest.fn();
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn().mockReturnValue({ insertedId: 99 }),
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted,
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 9, projectSlug: "default", projectName: "Default", keyId: 1, isAdmin: false },
      }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "draft@example.com",
          initial_message: "Draft only",
          draft: true,
          promote: false,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(notifyfeedbackubmitted).not.toHaveBeenCalled();
  });

  test("GET returns auth failure when key is invalid", async () => {
    const authFailure = Response.json({ success: false }, { status: 401 });
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn(),
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({ ok: false, response: authFailure }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.GET(req("http://localhost/api/v1/feedback"));
    expect(response.status).toBe(401);
  });

  test("GET returns admin error when non-admin key is used", async () => {
    const adminError = Response.json({ success: false, error: "Admin API key is required." }, { status: 403 });
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn(),
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 3, projectSlug: "p", projectName: "P", keyId: 1, isAdmin: false },
      }),
      requireAdmin: jest.fn().mockReturnValue(adminError),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.GET(req("http://localhost/api/v1/feedback"));
    expect(response.status).toBe(403);
  });

  test("GET returns data with parsed filters and bounded paging", async () => {
    const selectfeedback = jest.fn().mockReturnValue({
      data: [{ id: 1 }],
      total: 1,
    });
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn(),
      insertThreadMessage: jest.fn(),
      selectfeedback,
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 11, projectSlug: "slug", projectName: "Name", keyId: 1, isAdmin: true },
      }),
      requireAdmin: jest.fn().mockReturnValue(null),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.GET(
      req(
        "http://localhost/api/v1/feedback?page=0&pageSize=999&soft_delete=1&draft=0&__session_email=user%40example.com"
      )
    );

    expect(response.status).toBe(200);
    expect(selectfeedback).toHaveBeenCalledWith(
      { soft_delete: "1", draft: "0", __session_email: "user@example.com" },
      [],
      { page: 1, pageSize: 500 },
      11
    );
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        data: [{ id: 1 }],
        meta: expect.objectContaining({
          total: 1,
          page: 1,
          pageSize: 500,
        }),
      })
    );
  });

  test("GET uses default paging and empty filters when no query params are provided", async () => {
    const selectfeedback = jest.fn().mockReturnValue({ data: [], total: 0 });
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn(),
      insertThreadMessage: jest.fn(),
      selectfeedback,
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 11, projectSlug: "slug", projectName: "Name", keyId: 1, isAdmin: true },
      }),
      requireAdmin: jest.fn().mockReturnValue(null),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.GET(req("http://localhost/api/v1/feedback"));

    expect(response.status).toBe(200);
    expect(selectfeedback).toHaveBeenCalledWith({}, [], { page: 1, pageSize: 100 }, 11);
  });

  test("GET returns 500 when selectfeedback throws", async () => {
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn(),
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(() => {
        throw new Error("query failed");
      }),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 11, projectSlug: "slug", projectName: "Name", keyId: 1, isAdmin: true },
      }),
      requireAdmin: jest.fn().mockReturnValue(null),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.GET(req("http://localhost/api/v1/feedback?page=2&pageSize=10"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(expect.objectContaining({ success: false, error: "query failed" }));
  });

  test("GET returns fallback internal error message for non-Error throws", async () => {
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback: jest.fn(),
      insertThreadMessage: jest.fn(),
      selectfeedback: jest.fn(() => {
        throw 404;
      }),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: { projectId: 11, projectSlug: "slug", projectName: "Name", keyId: 1, isAdmin: true },
      }),
      requireAdmin: jest.fn().mockReturnValue(null),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/feedback/route");
    const response = await route.GET(req("http://localhost/api/v1/feedback"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(
      expect.objectContaining({ success: false, error: "Internal server error" })
    );
  });
});
