import { NextRequest } from "next/server";

function req(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

describe("feedback meta route", () => {
  test("covers OPTIONS, unauthorized, success, and catch branches", async () => {
    jest.resetModules();

    const authenticateApiKey = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, response: Response.json({ success: false }, { status: 401 }) })
      .mockResolvedValueOnce({ ok: true, auth: { projectId: 1 } })
      .mockResolvedValueOnce({ ok: true, auth: { projectId: 1 } });
    const getFeedbackTypes = jest.fn().mockReturnValue(["Bug"]);
    const getOrganisations = jest.fn().mockReturnValue(["Acme"]);
    const getfeedbacktatuses = jest
      .fn()
      .mockReturnValueOnce(["Open"])
      .mockImplementationOnce(() => {
        throw new Error("meta failed");
      });

    jest.doMock("@/lib/api-v1", () => ({
      authenticateApiKey,
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      getFeedbackTypes,
      getOrganisations,
      getfeedbacktatuses,
    }));

    const route = await import("@/app/api/v1/feedback/meta/route");

    const optionsRes = await route.OPTIONS();
    expect(optionsRes.status).toBe(204);

    const unauthorizedRes = await route.GET(req("http://localhost/api/v1/feedback/meta"));
    expect(unauthorizedRes.status).toBe(401);

    const successRes = await route.GET(req("http://localhost/api/v1/feedback/meta"));
    expect(successRes.status).toBe(200);
    expect(await successRes.json()).toEqual({
      types: ["Bug"],
      organisations: ["Acme"],
      statuses: ["Open"],
    });

    const errorRes = await route.GET(req("http://localhost/api/v1/feedback/meta"));
    expect(errorRes.status).toBe(500);
    expect(await errorRes.json()).toEqual(expect.objectContaining({ success: false, error: "meta failed" }));
    expect(getFeedbackTypes).toHaveBeenCalledTimes(2);
  });
});
