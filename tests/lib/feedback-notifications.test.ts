describe("feedback notifications", () => {
  const originalEnv = { ...process.env };
  const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      MAIL_PROVIDER: "disabled",
      FEEDBACK_DISTRIBUTION_EMAILS: "ops@example.com, bad, ops@example.com",
      NEXT_PUBLIC_APP_URL: "http://localhost:4001",
    };
    infoSpy.mockClear();
    warnSpy.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test("skips when recipients are globally disabled", async () => {
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      filterRecipientsWithFeedbackNotificationsEnabled: jest.fn().mockReturnValue([]),
      recordNotificationAudit: jest.fn(),
      getRecentlyNotified: jest.fn(),
    }));

    const { notifyfeedbackubmitted } = await import("@/lib/feedback-notifications");
    await notifyfeedbackubmitted({ feedbackId: 1, submittedByEmail: "user@example.com", page: "/test" });

    expect(infoSpy).toHaveBeenCalledWith(
      "[notifyfeedbackubmitted] Skipped: feedback notifications disabled for all target recipients or for the site."
    );
  });

  test("sends dev-mode notification with normalized recipients", async () => {
    const filterRecipientsWithFeedbackNotificationsEnabled = jest.fn((recipients: string[]) => recipients);
    jest.doMock("@/lib/feedback/sqlite-queries", () => ({
      filterRecipientsWithFeedbackNotificationsEnabled,
      recordNotificationAudit: jest.fn(),
      getRecentlyNotified: jest.fn().mockReturnValue(new Set()),
    }));

    const { notifyFeedbackDistributionOfReply } = await import("@/lib/feedback-notifications");
    await notifyFeedbackDistributionOfReply({
      feedbackId: 2,
      submitterEmail: "user@example.com",
      replierEmail: "admin@example.com",
      replierRole: "Admin",
    });

    expect(filterRecipientsWithFeedbackNotificationsEnabled).toHaveBeenCalledWith(["ops@example.com"]);
    expect(infoSpy).toHaveBeenCalledWith("[notifyFeedbackDistributionOfReply] ✉️ Email would be sent (dev mode)");
  });
});
