import { syncPromotedFeedbackToGitHub } from "@/lib/github-feedback-sync";
import { syncPromotedFeedbackToGitLab } from "@/lib/gitlab-feedback-sync";
import { type Platform, getAvailablePlatforms } from "@/lib/platform-detector";

type GitLabSyncResult = Awaited<ReturnType<typeof syncPromotedFeedbackToGitLab>>;
type GitHubSyncResult = Awaited<ReturnType<typeof syncPromotedFeedbackToGitHub>>;

export type PlatformSyncResult =
  | { platform: "gitlab"; result: GitLabSyncResult }
  | { platform: "github"; result: GitHubSyncResult };

export type PlatformSyncFailure = {
  platform: Platform;
  message: string;
};

export class PlatformSyncError extends Error {
  feedbackId: number;
  failures: PlatformSyncFailure[];
  partialResults: PlatformSyncResult[];

  constructor(feedbackId: number, failures: PlatformSyncFailure[], partialResults: PlatformSyncResult[]) {
    const platforms = failures.map((failure) => failure.platform).join(", ");
    super(`Feedback ${feedbackId} sync failed for: ${platforms}`);
    this.name = "PlatformSyncError";
    this.feedbackId = feedbackId;
    this.failures = failures;
    this.partialResults = partialResults;
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown sync error";
}

export async function syncPromotedFeedbackToAvailablePlatforms(
  feedbackId: number,
): Promise<PlatformSyncResult[]> {
  const platforms = getAvailablePlatforms();
  if (platforms.length === 0) {
    return [];
  }

  const settled = await Promise.allSettled(
    platforms.map(async (platform): Promise<PlatformSyncResult> => {
      if (platform === "gitlab") {
        return {
          platform,
          result: await syncPromotedFeedbackToGitLab(feedbackId),
        };
      }

      return {
        platform,
        result: await syncPromotedFeedbackToGitHub(feedbackId),
      };
    }),
  );

  const results: PlatformSyncResult[] = [];
  const failures: PlatformSyncFailure[] = [];

  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
      return;
    }

    failures.push({
      platform: platforms[index],
      message: toErrorMessage(outcome.reason),
    });
  });

  if (failures.length > 0) {
    throw new PlatformSyncError(feedbackId, failures, results);
  }

  return results;
}
