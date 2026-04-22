"use server";

import { env } from "@/lib/env-validation";
import {
  loadFeedbackForGitLab,
  persistGitLabIssueLink,
  type FeedbackForGitLab,
  type FeedbackMessageForGitLab,
} from "@/lib/feedback/sqlite-queries";

const GITLAB_API_BASE = "https://gitlab.com/api/v4";
const FEEDBACK_LABEL_PREFIX = "imdhub-feedback";

function requireGitLabConfig(): { token: string; projectId: string } {
  const token = env.GITLAB_ISSUES_REPORTING_TOKEN;
  const projectId = env.GITLAB_REPORTING_PROJECT_ID;
  if (!token || !projectId) {
    throw new Error("GitLab sync is not configured. Set GITLAB_REPORTING_PROJECT_ID and GITLAB_ISSUES_REPORTING_TOKEN.");
  }
  return { token, projectId };
}

type GitLabIssue = {
  iid: number;
  web_url?: string;
  description?: string;
  state?: "opened" | "closed";
};

type GitLabNote = {
  body: string;
};

function getFeedbackLabel(feedbackId: number) {
  return `feedback-${feedbackId}`;
}

function feedbackMarker(feedbackId: number) {
  return `<!-- imdhub-feedback-id:${feedbackId} -->`;
}

function messageMarker(messageId: number) {
  return `<!-- imdhub-feedback-message-id:${messageId} -->`;
}

async function gitlabRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token } = requireGitLabConfig();
  const res = await fetch(`${GITLAB_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "PRIVATE-TOKEN": token,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitLab API ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}

async function loadFeedback(feedbackId: number) {
  return loadFeedbackForGitLab(feedbackId);
}

async function persistIssueLink(
  feedbackId: number,
  issue: Pick<GitLabIssue, "iid" | "web_url">,
) {
  persistGitLabIssueLink(feedbackId, issue.iid, issue.web_url ?? null);
}

function issueTitle(feedback: FeedbackForGitLab) {
  const typeName = feedback.feedback_type_name || "Feedback";
  return `[Feedback #${feedback.id}] ${typeName}`;
}

function normaliseLabelPart(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
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

function buildThreadNote(message: FeedbackMessageForGitLab) {
  return [
    messageMarker(message.id),
    `### Follow-up Reply`,
    `_Author: ${message.author_role} · ${message.created_at ?? "N/A"}_`,
    "",
    message.message,
  ].join("\n");
}

async function findIssueByFeedbackId(feedbackId: number) {
  const { projectId } = requireGitLabConfig();
  const encodedProjectId = encodeURIComponent(projectId);
  const label = encodeURIComponent(getFeedbackLabel(feedbackId));
  const issues = await gitlabRequest<GitLabIssue[]>(
    `/projects/${encodedProjectId}/issues?state=all&labels=${label}&per_page=1&order_by=created_at&sort=desc`,
  );
  return issues[0] ?? null;
}

async function findIssueByIid(issueIid: number) {
  const { projectId } = requireGitLabConfig();
  return gitlabRequest<GitLabIssue>(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`);
}

async function createIssue(feedback: FeedbackForGitLab, firstMessage?: FeedbackMessageForGitLab) {
  const { projectId } = requireGitLabConfig();
  const labels = [
    FEEDBACK_LABEL_PREFIX,
    getFeedbackLabel(feedback.id),
    feedbackTypeLabel(feedback),
  ].join(",");

  return gitlabRequest<GitLabIssue>(`/projects/${encodeURIComponent(projectId)}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: issueTitle(feedback),
      labels,
      description: buildIssueDescription(feedback, firstMessage),
    }),
  });
}

async function listIssueNotes(issueIid: number) {
  const { projectId } = requireGitLabConfig();
  return gitlabRequest<GitLabNote[]>(
    `/projects/${encodeURIComponent(projectId)}/issues/${issueIid}/notes?per_page=100&order_by=created_at&sort=asc`,
  );
}

async function createIssueNote(issueIid: number, body: string) {
  const { projectId } = requireGitLabConfig();
  return gitlabRequest<GitLabNote>(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

async function closeIssue(issueIid: number) {
  const { projectId } = requireGitLabConfig();
  return gitlabRequest<GitLabIssue>(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`, {
    method: "PUT",
    body: JSON.stringify({ state_event: "close" }),
  });
}

async function reopenIssue(issueIid: number) {
  const { projectId } = requireGitLabConfig();
  return gitlabRequest<GitLabIssue>(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`, {
    method: "PUT",
    body: JSON.stringify({ state_event: "reopen" }),
  });
}

function extractMarkersFromText(text: string) {
  const markerRegex = /imdhub-feedback-message-id:(\d+)/g;
  const markers = new Set<number>();
  let match = markerRegex.exec(text);
  while (match) {
    markers.add(Number(match[1]));
    match = markerRegex.exec(text);
  }
  return markers;
}

/**
 * Ensures promoted feedback is mirrored to GitLab:
 * - creates one issue if absent
 * - uses first thread message as initial issue body
 * - posts remaining thread messages as follow-up notes
 * - deduplicates notes via hidden message markers
 */
export async function syncPromotedFeedbackToGitLab(feedbackId: number) {
  const numericId = Number(feedbackId);
  if (!numericId) return { synced: false, reason: "invalid_feedback_id" as const };

  const { feedback, thread } = await loadFeedback(numericId);
  if (!feedback) return { synced: false, reason: "feedback_not_found" as const };
  if (!feedback.promote || feedback.draft) {
    return { synced: false, reason: "not_promoted_or_draft" as const };
  }

  let issue: GitLabIssue | null = null;

  if (feedback.gitlab_issue_iid) {
    try {
      issue = await findIssueByIid(feedback.gitlab_issue_iid);
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

  const notes = await listIssueNotes(issue.iid);
  const seenMarkers = new Set<number>();

  const seedSources = [issue.description ?? "", ...notes.map((note) => note.body)];
  seedSources.forEach((source) => {
    extractMarkersFromText(source).forEach((marker) => seenMarkers.add(marker));
  });

  const firstMessageId = thread[0]?.id;
  const followUps = thread.filter((message) => message.id !== firstMessageId);

  let notesCreated = 0;
  for (const message of followUps) {
    if (seenMarkers.has(message.id)) continue;
    await createIssueNote(issue.iid, buildThreadNote(message));
    notesCreated += 1;
  }

  const isClosedInImdhub = feedback.feedback_status_name?.toLowerCase() === "closed";
  const isClosedInGitlab = issue.state === "closed";

  if (isClosedInImdhub && !isClosedInGitlab) {
    issue = await closeIssue(issue.iid);
  } else if (!isClosedInImdhub && isClosedInGitlab) {
    issue = await reopenIssue(issue.iid);
  }

  return {
    synced: true,
    issueIid: issue.iid,
    issueUrl: issue.web_url ?? null,
    notesCreated,
  } as const;
}
