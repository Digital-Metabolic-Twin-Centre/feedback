"use server";

import { env } from "@/lib/env-validation";
import {
  loadFeedbackForGitLab,
  persistGitHubIssueLink,
  type FeedbackForGitLab,
  type FeedbackMessageForGitLab,
} from "@/lib/feedback/sqlite-queries";

const FEEDBACK_LABEL_PREFIX = "dmtc-feedback";

function requireGitHubConfig(): { token: string; owner: string; repo: string } {
  const token = env.GITHUB_ISSUES_REPORTING_TOKEN;
  const owner = env.GITHUB_REPORTING_OWNER;
  const repo = env.GITHUB_REPORTING_REPO;
  if (!token || !owner || !repo) {
    throw new Error(
      "GitHub sync is not configured. Set GITHUB_ISSUES_REPORTING_TOKEN, GITHUB_REPORTING_OWNER, and GITHUB_REPORTING_REPO."
    );
  }
  return { token, owner, repo };
}

type GitHubIssue = {
  number: number;
  html_url?: string;
  body?: string;
  state?: "open" | "closed";
  id: number;
};

type GitHubComment = {
  body: string;
};

function getFeedbackLabel(feedbackId: number) {
  return `feedback-${feedbackId}`;
}

function feedbackMarker(feedbackId: number) {
  return `<!-- dmtc-feedback-id:${feedbackId} -->`;
}

function messageMarker(messageId: number) {
  return `<!-- dmtc-feedback-message-id:${messageId} -->`;
}

async function gitHubRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token } = requireGitHubConfig();
  const baseUrl = "https://api.github.com";
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "dmtc-feedback-sync",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}

async function loadFeedback(feedbackId: number) {
  return loadFeedbackForGitLab(feedbackId);
}

async function persistIssueLink(
  feedbackId: number,
  issue: Pick<GitHubIssue, "number" | "html_url">,
) {
  persistGitHubIssueLink(feedbackId, issue.number, issue.html_url ?? null);
}

function issueTitle(feedback: FeedbackForGitLab) {
  const typeName = feedback.feedback_type_name || "Feedback";
  return `[Feedback #${feedback.id}] ${typeName}`;
}

function normaliseLabelPart(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function feedbackTypeLabel(feedback: FeedbackForGitLab) {
  const typeName = feedback.feedback_type_name || "general";
  const normalized = normaliseLabelPart(typeName) || "general";
  return `${normalized}`;
}

function buildIssueDescription(feedback: FeedbackForGitLab, firstMessage?: FeedbackMessageForGitLab) {
  const header = [
    feedbackMarker(feedback.id),
    `## Feedback #${feedback.id}`,
    "",
    `- Type: ${feedback.feedback_type_name ?? "N/A"}`,
    `- Status: ${feedback.feedback_status_name ?? "N/A"}`,
    `- Clinical Site: ${feedback.organisation_name ?? "N/A"}`,
    `- Submitter Ref: ${feedback.submitter_ref ?? `feedback-${feedback.id}`}`,
    `- Page: ${feedback.page ?? "N/A"}`,
    `- Created At: ${feedback.created_at ?? "N/A"}`,
    "",
  ];

  if (!firstMessage) {
    header.push("No thread message found yet.");
    return header.join("\n");
  }

  header.push("### Initial Message");
  header.push("");
  header.push(messageMarker(firstMessage.id));
  header.push(`_Author: ${firstMessage.author_role} · ${firstMessage.created_at ?? "N/A"}_`);
  header.push("");
  header.push(firstMessage.message);
  return header.join("\n");
}

function buildThreadComment(message: FeedbackMessageForGitLab) {
  return [
    messageMarker(message.id),
    `### Follow-up Reply`,
    `_Author: ${message.author_role} · ${message.created_at ?? "N/A"}_`,
    "",
    message.message,
  ].join("\n");
}

async function findIssueByFeedbackId(feedbackId: number) {
  const { owner, repo } = requireGitHubConfig();
  const label = getFeedbackLabel(feedbackId);
  const issues = await gitHubRequest<GitHubIssue[]>(
    `/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=1`,
  );
  return issues[0] ?? null;
}

async function findIssueByNumber(issueNumber: number) {
  const { owner, repo } = requireGitHubConfig();
  return gitHubRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`);
}

async function createIssue(feedback: FeedbackForGitLab, firstMessage?: FeedbackMessageForGitLab) {
  const { owner, repo } = requireGitHubConfig();
  const labels = [
    FEEDBACK_LABEL_PREFIX,
    getFeedbackLabel(feedback.id),
    feedbackTypeLabel(feedback),
  ].filter(Boolean);

  return gitHubRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: issueTitle(feedback),
      body: buildIssueDescription(feedback, firstMessage),
      labels,
    }),
  });
}

async function listIssueComments(issueNumber: number) {
  const { owner, repo } = requireGitHubConfig();
  return gitHubRequest<GitHubComment[]>(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&sort=created&direction=asc`,
  );
}

async function createIssueComment(issueNumber: number, body: string) {
  const { owner, repo } = requireGitHubConfig();
  return gitHubRequest<GitHubComment>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

async function closeIssue(issueNumber: number) {
  const { owner, repo } = requireGitHubConfig();
  return gitHubRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" }),
  });
}

async function reopenIssue(issueNumber: number) {
  const { owner, repo } = requireGitHubConfig();
  return gitHubRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "open" }),
  });
}

function extractMarkersFromText(text: string) {
  const markerRegex = /dmtc-feedback-message-id:(\d+)/g;
  const markers = new Set<number>();
  let match = markerRegex.exec(text);
  while (match) {
    markers.add(Number(match[1]));
    match = markerRegex.exec(text);
  }
  return markers;
}

/**
 * Ensures promoted feedback is mirrored to GitHub:
 * - creates one issue if absent
 * - uses first thread message as initial issue body
 * - posts remaining thread messages as follow-up comments
 * - deduplicates comments via hidden message markers
 */
export async function syncPromotedFeedbackToGitHub(feedbackId: number) {
  const numericId = Number(feedbackId);
  if (!numericId) return { synced: false, reason: "invalid_feedback_id" as const };

  const { feedback, thread } = await loadFeedback(numericId);
  if (!feedback) return { synced: false, reason: "feedback_not_found" as const };
  if (!feedback.promote || feedback.draft) {
    return { synced: false, reason: "not_promoted_or_draft" as const };
  }

  let issue: GitHubIssue | null = null;

  if (feedback.github_issue_id) {
    try {
      issue = await findIssueByNumber(feedback.github_issue_id);
    } catch {
      issue = null;
    }
  }

  if (!issue) {
    issue = await findIssueByFeedbackId(numericId);
  }

  if (!issue) {
    issue = await createIssue(feedback, thread[0]);
  }

  await persistIssueLink(numericId, issue);

  const comments = await listIssueComments(issue.number);
  const seenMarkers = new Set<number>();

  const seedSources = [issue.body ?? "", ...comments.map((comment) => comment.body)];
  seedSources.forEach((source) => {
    extractMarkersFromText(source).forEach((marker) => seenMarkers.add(marker));
  });

  const firstMessageId = thread[0]?.id;
  const followUps = thread.filter((message) => message.id !== firstMessageId);

  let commentsCreated = 0;
  for (const message of followUps) {
    if (seenMarkers.has(message.id)) continue;
    await createIssueComment(issue.number, buildThreadComment(message));
    commentsCreated += 1;
  }

  const isClosedInDmtc = feedback.feedback_status_name?.toLowerCase() === "closed";
  const isClosedInGithub = issue.state === "closed";

  if (isClosedInDmtc && !isClosedInGithub) {
    issue = await closeIssue(issue.number);
  } else if (!isClosedInDmtc && isClosedInGithub) {
    issue = await reopenIssue(issue.number);
  }

  return {
    synced: true,
    issueNumber: issue.number,
    issueUrl: issue.html_url ?? null,
    commentsCreated,
  } as const;
}
