describe("promoted feedback sync helper", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GITLAB_ISSUES_REPORTING_TOKEN;
    delete process.env.GITLAB_REPORTING_PROJECT_ID;
    delete process.env.GITHUB_ISSUES_REPORTING_TOKEN;
    delete process.env.GITHUB_REPORTING_OWNER;
    delete process.env.GITHUB_REPORTING_REPO;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("syncs only to configured GitHub platform", async () => {
    process.env.GITHUB_ISSUES_REPORTING_TOKEN = "token";
    process.env.GITHUB_REPORTING_OWNER = "owner";
    process.env.GITHUB_REPORTING_REPO = "repo";

    const syncPromotedFeedbackToGitHub = jest.fn().mockResolvedValue({ synced: true, issueNumber: 42 });
    const syncPromotedFeedbackToGitLab = jest.fn().mockResolvedValue({ synced: true, issueIid: 77 });

    jest.doMock("@/lib/github-feedback-sync", () => ({
      syncPromotedFeedbackToGitHub,
    }));
    jest.doMock("@/lib/gitlab-feedback-sync", () => ({
      syncPromotedFeedbackToGitLab,
    }));

    const { syncPromotedFeedbackToAvailablePlatforms } = await import("@/lib/promoted-feedback-sync");

    await expect(syncPromotedFeedbackToAvailablePlatforms(123)).resolves.toEqual([
      {
        platform: "github",
        result: { synced: true, issueNumber: 42 },
      },
    ]);
    expect(syncPromotedFeedbackToGitHub).toHaveBeenCalledWith(123);
    expect(syncPromotedFeedbackToGitLab).not.toHaveBeenCalled();
  });

  test("throws a structured error when any configured platform fails", async () => {
    process.env.GITLAB_ISSUES_REPORTING_TOKEN = "gitlab-token";
    process.env.GITLAB_REPORTING_PROJECT_ID = "group/project";
    process.env.GITHUB_ISSUES_REPORTING_TOKEN = "github-token";
    process.env.GITHUB_REPORTING_OWNER = "owner";
    process.env.GITHUB_REPORTING_REPO = "repo";

    const syncPromotedFeedbackToGitHub = jest.fn().mockResolvedValue({ synced: true, issueNumber: 42 });
    const syncPromotedFeedbackToGitLab = jest.fn().mockRejectedValue(new Error("GitLab offline"));

    jest.doMock("@/lib/github-feedback-sync", () => ({
      syncPromotedFeedbackToGitHub,
    }));
    jest.doMock("@/lib/gitlab-feedback-sync", () => ({
      syncPromotedFeedbackToGitLab,
    }));

    const { PlatformSyncError, syncPromotedFeedbackToAvailablePlatforms } = await import(
      "@/lib/promoted-feedback-sync"
    );

    await expect(syncPromotedFeedbackToAvailablePlatforms(456)).rejects.toMatchObject({
      name: "PlatformSyncError",
      feedbackId: 456,
      failures: [{ platform: "gitlab", message: "GitLab offline" }],
      partialResults: [{ platform: "github", result: { synced: true, issueNumber: 42 } }],
    });
    await expect(syncPromotedFeedbackToAvailablePlatforms(456)).rejects.toBeInstanceOf(PlatformSyncError);
  });
});
