"use server";

import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import { getUserGroupsFromSession } from "@/utils/auth/get-user-groups";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";
import { logError } from "@/lib/error-logger";
import type { FeedbackThreadMessage } from "../../feedbacks/types/feedback-types";
import {
  getFeedbackOwner,
  getThreadMessages,
  insertThreadMessage,
} from "@/lib/feedback/sqlite-queries";
import {
  notifyFeedbackDistributionOfReply,
  notifyFeedbackSubmitterOfReply,
} from "@/lib/feedback-notifications";
import { syncPromotedFeedbackToGitLab } from "@/lib/gitlab-feedback-sync";

type ThreadResult =
  | { success: true; data: FeedbackThreadMessage[] }
  | { success: false; message: string };

type AddMessageResult =
  | { success: true; message: string; data: FeedbackThreadMessage[] }
  | { success: false; message: string };

async function getFeedbackAccess(feedbackId: number, submitterEmail?: string) {
  const [sessionEmail] = await getUserEmailFromSession();
  const { groups } = await getUserGroupsFromSession();
  const isAdmin = groups
    .map((g) => g.toLowerCase().trim())
    .includes(ADMIN_GROUP_VIEW_PERMISSIONS.toLowerCase().trim());

  const userEmail = sessionEmail || submitterEmail || "";

  const record = getFeedbackOwner(feedbackId);
  if (!record) {
    return { authorized: false, message: "Feedback record not found." } as const;
  }

  if (!isAdmin && userEmail.toLowerCase().trim() !== record.email.toLowerCase().trim()) {
    return {
      authorized: false,
      message: "You are not allowed to access this feedback thread.",
    } as const;
  }

  return {
    authorized: true,
    isAdmin,
    userEmail: userEmail || "anonymous",
    feedbackOwnerEmail: record.email,
    isClosed: record.status_name === "Closed",
  } as const;
}

export async function getFeedbackThreadMessages(
  feedbackId: number,
  submitterEmail?: string
): Promise<ThreadResult> {
  const access = await getFeedbackAccess(feedbackId, submitterEmail);
  if (!access.authorized) {
    return { success: false, message: access.message };
  }

  const data = getThreadMessages(feedbackId);
  return { success: true, data };
}

export async function addFeedbackThreadMessage(input: {
  feedbackId: number;
  message: string;
  submitterEmail?: string;
  suppressDistributionNotification?: boolean;
}): Promise<AddMessageResult> {
  const feedbackId = Number(input.feedbackId);
  const message = input.message.trim();

  if (!feedbackId) return { success: false, message: "Feedback record is required." };
  if (!message)    return { success: false, message: "Reply cannot be empty." };

  const access = await getFeedbackAccess(feedbackId, input.submitterEmail);
  if (!access.authorized) {
    return { success: false, message: access.message };
  }

  if (access.isClosed) {
    return { success: false, message: "This feedback is closed and can no longer accept replies." };
  }

  try {
    insertThreadMessage({
      feedbackId,
      authorRole: access.isAdmin ? "Admin" : "User",
      message,
      createdBy: access.userEmail,
    });
  } catch (err) {
    logError(err, { operation: "AddFeedbackThreadMessage", metadata: { feedbackId } }, "error");
    return { success: false, message: "Failed to add reply to the thread." };
  }

  const data = getThreadMessages(feedbackId);

  notifyFeedbackSubmitterOfReply({
    feedbackId,
    submitterEmail: access.feedbackOwnerEmail,
    replierEmail: access.userEmail,
    replierRole: access.isAdmin ? "Admin" : "User",
  }).catch((err) =>
    logError(err, { operation: "NotifyFeedbackSubmitterOfReply", metadata: { feedbackId } }, "error")
  );

  if (!input.suppressDistributionNotification) {
    notifyFeedbackDistributionOfReply({
      feedbackId,
      submitterEmail: access.feedbackOwnerEmail,
      replierEmail: access.userEmail,
      replierRole: access.isAdmin ? "Admin" : "User",
    }).catch((err) =>
      logError(err, { operation: "NotifyFeedbackDistributionOfReply", metadata: { feedbackId } }, "error")
    );
  }

  syncPromotedFeedbackToGitLab(feedbackId).catch((err) =>
    logError(err, { operation: "SyncPromotedFeedbackToGitLabOnReply", metadata: { feedbackId } }, "error")
  );

  return { success: true, message: "Reply added to the feedback thread.", data };
}
