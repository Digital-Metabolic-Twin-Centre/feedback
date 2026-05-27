import type { FeedbackForGitLab, FeedbackMessageForGitLab } from "@/lib/feedback/sqlite-queries";

describe("github feedback sync", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  const feedback: FeedbackForGitLab = {
    id: 12,
    submitter_ref: "fb-12",
    organisation_name: "Org",
    page: "/page",
    feedback_type_name: "Bug Report",
    feedback_status_name: "Open",
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
      message: "Initial message",
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
      GITHUB_ISSUES_REPORTING_TOKEN: "token",
      GITHUB_REPORTING_OWNER: "owner",
      GITHUB_REPORTING_REPO: "repo",
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("returns invalid feedback id for non-numeric values", async () => {
    const { syncPromotedFeedbackToGitHub } = await import("@/lib/github-feedback-sync");
    await expect(syncPromotedFeedbackToGitHub(Number.NaN)).resolves.toEqual({
      synced: false,
      reason: "invalid_feedback_id",
    });
  });

  test("creates issue, comments, and persists link", async () => {
    const loadFeedbackForGitLab = jest.fn().mockResolvedValue({ feedback, thread });
    const persistGitHubIssueLink = jest.fn();
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      loadFeedbackForGitLab,
      persistGitHubIssueLink,
    }));

    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        number: 44,
        html_url: "https://github.com/owner/repo/issues/44",
        body: "<!-- dmtc-feedback-id:12 -->",
        state: "open",
        id: 44,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ body: "ok" }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const { syncPromotedFeedbackToGitHub } = await import("@/lib/github-feedback-sync");
    await expect(syncPromotedFeedbackToGitHub(12)).resolves.toEqual({
      synced: true,
      issueNumber: 44,
      issueUrl: "https://github.com/owner/repo/issues/44",
      commentsCreated: 1,
    });

    expect(loadFeedbackForGitLab).toHaveBeenCalledWith(12);
    expect(persistGitHubIssueLink).toHaveBeenCalledWith(12, 44, "https://github.com/owner/repo/issues/44");
  });

  test("reopens a closed issue and skips duplicate marker comments", async () => {
    const loadFeedbackForGitLab = jest.fn().mockResolvedValue({
      feedback: { ...feedback, github_issue_id: 77 },
      thread,
    });
    const persistGitHubIssueLink = jest.fn();
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      loadFeedbackForGitLab,
      persistGitHubIssueLink,
    }));

    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new Error("missing")) // find by number
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        number: 77,
        html_url: "https://github.com/owner/repo/issues/77",
        body: "<!-- dmtc-feedback-message-id:2 -->",
        state: "closed",
        id: 77,
      }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ body: "<!-- dmtc-feedback-message-id:2 -->" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        number: 77,
        html_url: "https://github.com/owner/repo/issues/77",
        state: "open",
        id: 77,
      }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const { syncPromotedFeedbackToGitHub } = await import("@/lib/github-feedback-sync");
    await expect(syncPromotedFeedbackToGitHub(12)).resolves.toEqual({
      synced: true,
      issueNumber: 77,
      issueUrl: "https://github.com/owner/repo/issues/77",
      commentsCreated: 0,
    });
  });
});
