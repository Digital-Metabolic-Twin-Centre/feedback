import { NextRequest } from "next/server";

function req(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

describe("feedback create promote sync", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("syncs immediately when feedback is created with promote true", async () => {
    const insertFeedback = jest.fn().mockReturnValue({ insertedId: 321 });
    const insertThreadMessage = jest.fn();
    const notifyfeedbackubmitted = jest.fn().mockResolvedValue(undefined);
    const syncPromotedFeedbackToAvailablePlatforms = jest.fn().mockResolvedValue([]);

    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback,
      insertThreadMessage,
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted,
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: {
          projectId: 7,
          projectSlug: "default",
          projectName: "Default",
        },
      }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) =>
        Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms,
    }));

    const feedbackRoute = await import("@/app/api/v1/feedback/route");

    const res = await feedbackRoute.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "test-key",
        },
        body: JSON.stringify({
          email: "promote@example.com",
          initial_message: "Please promote this",
          promote: true,
          draft: false,
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(insertFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "promote@example.com",
        promote: true,
        draft: false,
        project_id: 7,
      }),
    );
    expect(insertThreadMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        feedbackId: 321,
        message: "Please promote this",
      }),
    );
    expect(syncPromotedFeedbackToAvailablePlatforms).toHaveBeenCalledWith(321);
    expect(notifyfeedbackubmitted).toHaveBeenCalled();
  });

  test("does not sync while feedback is still a draft", async () => {
    const insertFeedback = jest.fn().mockReturnValue({ insertedId: 654 });
    const insertThreadMessage = jest.fn();
    const notifyfeedbackubmitted = jest.fn().mockResolvedValue(undefined);
    const syncPromotedFeedbackToAvailablePlatforms = jest.fn().mockResolvedValue([]);

    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      insertFeedback,
      insertThreadMessage,
      selectfeedback: jest.fn(),
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitted,
    }));
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({
        ok: true,
        auth: {
          projectId: 7,
          projectSlug: "default",
          projectName: "Default",
        },
      }),
      requireAdmin: jest.fn(),
      v1Json: (body: unknown, init?: ResponseInit) =>
        Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: jest.fn(),
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      PlatformSyncError: class PlatformSyncError extends Error {},
      syncPromotedFeedbackToAvailablePlatforms,
    }));

    const feedbackRoute = await import("@/app/api/v1/feedback/route");

    const res = await feedbackRoute.POST(
      req("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "test-key",
        },
        body: JSON.stringify({
          email: "draft@example.com",
          initial_message: "Draft promoted feedback",
          promote: true,
          draft: true,
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(syncPromotedFeedbackToAvailablePlatforms).not.toHaveBeenCalled();
    expect(notifyfeedbackubmitted).not.toHaveBeenCalled();
  });
});
