import { NextRequest } from "next/server";

function req(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

describe("feedback route branches", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("feedback meta route returns 500 on lookup failure", async () => {
    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey: jest.fn().mockResolvedValue({ ok: true, auth: { projectId: 1 } }),
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: jest.fn(),
    }));
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      getfeedbacktatuses: jest.fn(() => { throw new Error("boom"); }),
      getFeedbackTypes: jest.fn().mockReturnValue([]),
      getOrganisations: jest.fn().mockReturnValue([]),
    }));

    const route = await import("@/app/api/v1/feedback/meta/route");
    const res = await route.GET(req("http://localhost/api/v1/feedback/meta"));
    expect(res.status).toBe(500);
  });

  test("feedback by id route covers includeMessages and invalid payload branches", async () => {
    const authenticateApiKey = jest.fn().mockResolvedValue({
      ok: true,
      auth: { projectId: 7, keyId: 12 },
    });
    const getFeedbackById = jest.fn()
      .mockReturnValueOnce({ id: 1, email: "user@example.com", feedback_status_name: "Open" })
      .mockReturnValueOnce({ id: 1, email: "user@example.com", feedback_status_name: "Closed" })
      .mockReturnValueOnce({ id: 1, email: "user@example.com", feedback_status_name: "Open" });
    const getThreadMessages = jest.fn().mockReturnValue([{ id: 1 }]);
    const insertThreadMessage = jest.fn();
    const notifyfeedbackubmitterOfReply = jest.fn().mockResolvedValue(undefined);
    const notifyFeedbackDistributionOfReply = jest.fn().mockResolvedValue(undefined);
    const syncPromotedFeedbackToAvailablePlatforms = jest.fn().mockResolvedValue([]);
    const logError = jest.fn();

    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey,
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: jest.fn(),
    }));
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      getFeedbackById,
      getThreadMessages,
      insertThreadMessage,
    }));
    jest.doMock("@/lib/feedback-notifications", () => ({
      notifyfeedbackubmitterOfReply,
      notifyFeedbackDistributionOfReply,
    }));
    jest.doMock("@/lib/promoted-feedback-sync", () => ({
      syncPromotedFeedbackToAvailablePlatforms,
    }));
    jest.doMock("@/lib/error-logger", () => ({ logError }));

    const route = await import("@/app/api/v1/feedback/[id]/route");

    const getRes = await route.GET(
      req("http://localhost/api/v1/feedback/1?includeMessages=true"),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(getRes.status).toBe(200);

    const invalidRes = await route.POST(
      req("http://localhost/api/v1/feedback/1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(invalidRes.status).toBe(400);

    const closedRes = await route.POST(
      req("http://localhost/api/v1/feedback/1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(closedRes.status).toBe(409);

    const postRes = await route.POST(
      req("http://localhost/api/v1/feedback/1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello", createdBy: "user@example.com" }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(postRes.status).toBe(201);
    expect(insertThreadMessage).toHaveBeenCalled();
    expect(notifyfeedbackubmitterOfReply).toHaveBeenCalled();
    expect(notifyFeedbackDistributionOfReply).toHaveBeenCalled();
    expect(syncPromotedFeedbackToAvailablePlatforms).toHaveBeenCalledWith(1);
  });
});
