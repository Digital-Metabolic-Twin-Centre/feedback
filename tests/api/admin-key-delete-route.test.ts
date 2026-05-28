import { NextRequest } from "next/server";

function req(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

describe("admin key delete route", () => {
  test("covers OPTIONS, auth failure, invalid id, missing key, success, and catch", async () => {
    jest.resetModules();

    const authorizeBootstrap = jest
      .fn()
      .mockReturnValueOnce(Response.json({ success: false }, { status: 403 }))
      .mockReturnValue(null);
    const revokeApiKeyById = jest
      .fn()
      .mockReturnValueOnce({ success: false })
      .mockReturnValueOnce({ success: true })
      .mockImplementationOnce(() => {
        throw new Error("revoke boom");
      });

    jest.doMock("@/lib/api-v1", () => ({
      authorizeBootstrap,
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));
    jest.doMock("@/lib/api-keys", () => ({ revokeApiKeyById }));

    const route = await import("@/app/api/v1/admin/keys/[id]/route");

    expect((await route.OPTIONS()).status).toBe(204);

    expect(
      (await route.DELETE(req("http://localhost"), { params: Promise.resolve({ id: "1" }) })).status
    ).toBe(403);

    expect(
      (await route.DELETE(req("http://localhost"), { params: Promise.resolve({ id: "abc" }) })).status
    ).toBe(400);

    expect(
      (await route.DELETE(req("http://localhost"), { params: Promise.resolve({ id: "2" }) })).status
    ).toBe(404);

    const successRes = await route.DELETE(req("http://localhost"), { params: Promise.resolve({ id: "3" }) });
    expect(successRes.status).toBe(200);
    expect(await successRes.json()).toEqual(expect.objectContaining({ success: true, revokedKeyId: 3 }));

    expect(
      (await route.DELETE(req("http://localhost"), { params: Promise.resolve({ id: "4" }) })).status
    ).toBe(500);
  });
});
