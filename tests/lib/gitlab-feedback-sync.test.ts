import type { FeedbackForGitLab, FeedbackMessageForGitLab } from "@/lib/feedback/sqlite-queries";

describe("gitlab feedback sync", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  const feedback: FeedbackForGitLab = {
    id: 9,
    submitter_ref: "fb-9",
    organisation_name: "Org",
    page: "/page",
    feedback_type_name: "Feature Request",
    feedback_status_name: "Closed",
    promote: true,
    draft: false,
    gitlab_issue_id: null,
    gitlab_issue_url: null,
    github_issue_id: null,
    github_issue_url: null,
    promoted_at: null,
    created_by: "user@example.com",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_by: "user@example.com",
    updated_at: "2024-01-01T00:00:00.000Z",
  };

  const thread: FeedbackMessageForGitLab[] = [
    {
      id: 1,
      author_role: "User",
      message: "Initial",
      created_by: "user@example.com",
      created_at: "2024-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      author_role: "Admin",
      message: "Follow up",
      created_by: "admin@example.com",
      created_at: "2024-01-02T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      GITLAB_ISSUES_REPORTING_TOKEN: "token",
      GITLAB_REPORTING_PROJECT_ID: "group/project",
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("returns feedback not found when sqlite lookup misses", async () => {
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      loadFeedbackForGitLab: jest.fn().mockResolvedValue({ feedback: null, thread: [] }),
      persistGitLabIssueLink: jest.fn(),
    }));

    const { syncPromotedFeedbackToGitLab } = await import("@/lib/gitlab-feedback-sync");
    await expect(syncPromotedFeedbackToGitLab(9)).resolves.toEqual({
      synced: false,
      reason: "feedback_not_found",
    });
  });

  test("creates issue and closes it when feedback is closed", async () => {
    const loadFeedbackForGitLab = jest.fn().mockResolvedValue({ feedback, thread });
    const persistGitLabIssueLink = jest.fn();
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      loadFeedbackForGitLab,
      persistGitLabIssueLink,
    }));

    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        iid: 33,
        web_url: "https://gitlab.com/group/project/-/issues/33",
        description: "<!-- dmtc-feedback-id:9 -->",
        state: "opened",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ body: "ok" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        iid: 33,
        web_url: "https://gitlab.com/group/project/-/issues/33",
        state: "closed",
      }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const { syncPromotedFeedbackToGitLab } = await import("@/lib/gitlab-feedback-sync");
    await expect(syncPromotedFeedbackToGitLab(9)).resolves.toEqual({
      synced: true,
      issueIid: 33,
      issueUrl: "https://gitlab.com/group/project/-/issues/33",
      notesCreated: 1,
    });

    expect(persistGitLabIssueLink).toHaveBeenCalledWith(9, 33, "https://gitlab.com/group/project/-/issues/33");
  });
});
