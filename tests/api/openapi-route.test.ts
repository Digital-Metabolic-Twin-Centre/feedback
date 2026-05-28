describe("openapi route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("OPTIONS returns preflight response", async () => {
    jest.doMock("@/lib/openapi-feedback", () => ({
      feedbackOpenApiSpec: jest.fn(),
    }));
    jest.doMock("@/lib/api-v1", () => ({
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/openapi.json/route");
    const response = await route.OPTIONS();
    expect(response.status).toBe(204);
  });

  test("GET uses FEEDBACK_API_URL first, then APP_URL fallback", async () => {
    const feedbackOpenApiSpec = jest.fn((baseUrl?: string) => ({ openapi: "3.0.0", baseUrl }));
    jest.doMock("@/lib/openapi-feedback", () => ({ feedbackOpenApiSpec }));
    jest.doMock("@/lib/api-v1", () => ({
      v1Json: (body: unknown, init?: ResponseInit) => Response.json(body, { status: init?.status ?? 200 }),
      v1PreflightResponse: () => new Response(null, { status: 204 }),
    }));

    const route = await import("@/app/api/v1/openapi.json/route");

    process.env.NEXT_PUBLIC_FEEDBACK_API_URL = "https://feedback.example.com";
    let res = await route.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ baseUrl: "https://feedback.example.com" }));

    delete process.env.NEXT_PUBLIC_FEEDBACK_API_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    res = await route.GET();
    expect(await res.json()).toEqual(expect.objectContaining({ baseUrl: "https://app.example.com" }));

    expect(feedbackOpenApiSpec).toHaveBeenCalledTimes(2);
  });
});
