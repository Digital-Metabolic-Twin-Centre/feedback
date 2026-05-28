import { NextRequest } from "next/server";

function req(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

describe("admin key rotate route", () => {
  test("covers OPTIONS, invalid id, missing key, success, and catch branches", async () => {
    jest.resetModules();

    const authorizeBootstrap = jest.fn().mockReturnValue(null);
    const rotateApiKeyById = jest
      .fn()
      .mockReturnValueOnce({ success: false, error: "not found" })
      .mockReturnValueOnce({ success: true, data: { newKeyId: 2 } })
      .mockImplementationOnce(() => {
        throw new Error("rotate boom");
      });

    jest.doMock("@/lib/api-v1", () => ({
      authorizeBootstrap,
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));
    jest.doMock("@/lib/api-keys", () => ({ rotateApiKeyById }));

    const route = await import("@/app/api/v1/admin/keys/[id]/rotate/route");

    expect((await route.OPTIONS()).status).toBe(204);

    expect(
      (
        await route.POST(req("http://localhost", { method: "POST" }), {
          params: Promise.resolve({ id: "bad" }),
        })
      ).status
    ).toBe(400);

    expect(
      (
        await route.POST(req("http://localhost", { method: "POST" }), {
          params: Promise.resolve({ id: "1" }),
        })
      ).status
    ).toBe(404);

    const successRes = await route.POST(req("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "2" }),
    });
    expect(successRes.status).toBe(201);
    expect(await successRes.json()).toEqual(expect.objectContaining({ success: true }));

    expect(
      (
        await route.POST(req("http://localhost", { method: "POST" }), {
          params: Promise.resolve({ id: "3" }),
        })
      ).status
    ).toBe(500);
  });
});
