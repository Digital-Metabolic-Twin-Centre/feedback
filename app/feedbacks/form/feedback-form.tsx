"use client";

import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { ZodRawShape, ZodTypeAny, ZodError } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Select from "react-select";
import { FeedbackRenderPanel } from "./render-panel";
import { useSharedFormState } from "@/hooks/form-state-provider";
import Loading from "@/app/loading";
import { fkFields, showRequiredFieldsIcon } from "../utils/feedback-config";
import {
  baseFeedbackSchema,
  feedbackFormSchema,
  FeedbackFormData,
} from "../validation/schema";
import {
  FeedbackData,
  FeedbackThreadMessage,
  ForeignItem,
} from "../types/feedback-types";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Asterisk, Info } from "lucide-react";
import { secureFetch } from "@/hooks/secure-fetch";
import { API_ENDPOINTS } from "@/lib/urls";
import { useCustomFormWatch } from "@/hooks/use-form-value-watch";
import { ForeignOption } from "@/types/common";
import { useClientSession } from "@/utils/auth/get-user-client-session";
import { usePathname } from "next/navigation";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackCommentContent } from "../utils/comment-rich-text";
import {
  addFeedbackThreadMessage,
  getFeedbackThreadMessages,
} from "../../actions/feedback/thread";
import { formatDateTime } from "@/utils/components/format-date";

interface FeedbackFormProps {
  initialValues?: Partial<FeedbackData>;
  prefillValues?: Partial<FeedbackFormData>;
  schema: string;
  onClose?: () => void;
  tableName: string;
  refetchTable?: () => void;
}

export default function FeedbackForm({
  initialValues,
  prefillValues,
  schema,
  onClose,
  tableName,
  refetchTable,
}: FeedbackFormProps) {
  const isEditMode = Boolean(initialValues);
  const pathname = usePathname();

  const { getUserEmail, getUserGroups } = useClientSession();
  const userEmail = getUserEmail();
  const isAdmin = getUserGroups().includes(ADMIN_GROUP_VIEW_PERMISSIONS);

  const { loadingStatus, setLoadingStatus, setErrorMessage } =
    useSharedFormState();

  const [foreignOptions, setForeignOptions] = useState<
    Record<string, ForeignOption[]>
  >({});
  const [threadMessages, setThreadMessages] = useState<FeedbackThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadReply, setThreadReply] = useState("");
  const [sendingThreadReply, setSendingThreadReply] = useState(false);
  const commentRefs = useRef<
    Partial<Record<"initial_message" | "admin_reply_message", HTMLTextAreaElement | null>>
  >({});

  const defaultValues: Partial<FeedbackFormData> = {
    id: initialValues?.id,
    email: initialValues?.email ?? prefillValues?.email ?? userEmail ?? "",
    clinical_site: initialValues?.clinical_site ?? prefillValues?.clinical_site,
    page: initialValues?.page ?? prefillValues?.page ?? pathname ?? "",
    initial_message: "",
    feedback_type: initialValues?.feedback_type ?? prefillValues?.feedback_type,
    feedback_status:
      initialValues?.feedback_status ?? prefillValues?.feedback_status,
    promote: initialValues?.promote ?? prefillValues?.promote ?? false,
    admin_reply_message: "",
    draft: initialValues?.draft ?? prefillValues?.draft ?? false,
    soft_delete: initialValues?.soft_delete ?? prefillValues?.soft_delete ?? false,
  };

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues,
    mode: "onChange",
    shouldUnregister: false,
  });
  const {
    formState: { isSubmitting },
  } = form;

  const { value: isDraft } = useCustomFormWatch(form, "draft");

  const tableNameMap = useMemo<Record<string, string>>(
    () => ({
      clinical_site: "organisations",
      feedback_type: "feedback_types",
      feedback_status: "feedback_status",
    }),
    [],
  );

  const fetchForeignOptions = useCallback(async () => {
    try {
      setLoadingStatus("loading");
      setErrorMessage(null);

      const refsTables = fkFields.map((f) => tableNameMap[f] ?? f).join(",");

      const res = await secureFetch(
        `${API_ENDPOINTS.SELECT_MULTIPLE}?schema=imdhub_refs&tables=${refsTables}&soft_delete=false&draft=false`,
      );

      if (!res.ok) throw new Error("Failed to load feedback reference data");

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      const clinicalSiteOpts: ForeignOption[] = (
        json.data.organisations ?? []
      ).map((item: ForeignItem) => ({
        value: item.id,
        label: item.label ?? item.name ?? String(item.id),
      }));

      const feedbackTypeOpts: ForeignOption[] = (
        json.data.feedback_types ?? []
      ).map((item: ForeignItem) => ({
        value: item.id,
        label: item.label ?? item.name ?? String(item.id),
      }));

      const feedbackStatusOpts: ForeignOption[] = (
        json.data.feedback_status ?? []
      ).map((item: ForeignItem) => ({
        value: item.id,
        label: item.label ?? item.name ?? String(item.id),
      }));

      if (clinicalSiteOpts.length > 0 && !form.getValues("clinical_site")) {
        form.setValue("clinical_site", Number(clinicalSiteOpts[0].value), {
          shouldDirty: false,
          shouldValidate: true,
        });
      }

      if (feedbackTypeOpts.length > 0 && !form.getValues("feedback_type")) {
        form.setValue("feedback_type", Number(feedbackTypeOpts[0].value), {
          shouldDirty: false,
          shouldValidate: true,
        });
      }

      if (feedbackStatusOpts.length > 0 && !form.getValues("feedback_status")) {
        form.setValue("feedback_status", Number(feedbackStatusOpts[0].value), {
          shouldDirty: false,
          shouldValidate: true,
        });
      }

      setForeignOptions({
        clinical_site: clinicalSiteOpts,
        feedback_type: feedbackTypeOpts,
        feedback_status: feedbackStatusOpts,
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load feedback reference data");
    } finally {
      setLoadingStatus("idle");
    }
  }, [form, setErrorMessage, setLoadingStatus, tableNameMap]);

  useEffect(() => {
    fetchForeignOptions();
  }, [fetchForeignOptions]);

  useEffect(() => {
    const feedbackId = Number(initialValues?.id);
    if (!isEditMode || !feedbackId) {
      setThreadMessages([]);
      setThreadReply("");
      return;
    }

    const loadThread = async () => {
      setThreadLoading(true);
      const result = await getFeedbackThreadMessages(feedbackId);
      if (result.success) {
        setThreadMessages(result.data);
      } else {
        toast.error(result.message);
      }
      setThreadLoading(false);
    };

    loadThread();
  }, [initialValues?.id, isEditMode]);

  const { handleSubmit } = form;
  const isClosedFeedback = initialValues?.feedback_status_name === "Closed";
  const isReplyOnlyMode = isEditMode && !isAdmin;

  const submitData = handleSubmit(
    async (data) => {
      try {
        const parseResult = feedbackFormSchema.safeParse(data);
        if (!parseResult.success) {
          parseResult.error.issues.forEach((issue) => {
            form.setError(issue.path[0] as keyof FeedbackFormData, {
              type: "manual",
              message: issue.message,
            });
          });
          toast.error(
            parseResult.error.issues[0]?.message ?? "Validation failed.",
          );
          return;
        }

        let adminPayload = parseResult.data;
        const initialThreadMessage = (
          isAdmin
            ? parseResult.data.admin_reply_message ?? parseResult.data.initial_message
            : parseResult.data.initial_message
        )?.trim();

        if (!isAdmin) {
          const nonAdminPayload = { ...adminPayload } as Partial<
            typeof adminPayload
          >;
          delete nonAdminPayload.feedback_status;
          delete nonAdminPayload.promote;
          delete nonAdminPayload.draft;
          delete nonAdminPayload.admin_reply_message;
          delete nonAdminPayload.initial_message;
          adminPayload = nonAdminPayload as typeof adminPayload;
        }

        delete adminPayload.initial_message;
        delete adminPayload.admin_reply_message;

        const payload = adminPayload;

        let res: Response;
        if (isEditMode) {
          const where = { id: data.id };
          res = await secureFetch(API_ENDPOINTS.UPDATE, {
            method: "POST",
            body: JSON.stringify({
              schema,
              tableName,
              updates: payload,
              where,
            }),
          });
        } else {
          if (!isAdmin) {
            payload.feedback_status = 1; // Set to 'Open' status for non-admin submissions
          }
          res = await secureFetch(API_ENDPOINTS.CREATE, {
            method: "POST",
            body: JSON.stringify({
              schema,
              tableName,
              data: payload,
            }),
          });
        }

        const responseJson = await res.json();

        if (responseJson.success) {
          if (!isEditMode && initialThreadMessage) {
            const createdFeedbackId = Number(responseJson.insertedId ?? 0);

            if (createdFeedbackId) {
              const threadResult = await addFeedbackThreadMessage({
                feedbackId: createdFeedbackId,
                message: initialThreadMessage,
                submitterEmail: data.email,
                suppressDistributionNotification: true,
              });

              if (!threadResult.success) {
                toast.error(threadResult.message);
                return;
              }
            }
          }

          toast.success(
            isEditMode
              ? "Feedback updated successfully."
              : "Feedback created successfully.",
          );
          refetchTable?.();
          onClose?.();
        } else {
          toast.error(responseJson.message);
        }
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          const firstError = err.errors?.[0]?.message;
          toast.error(
            firstError ?? "Validation failed. Please check the form.",
          );
        } else {
          toast.error("Unexpected validation error.");
          console.error("Validation exception:", err);
        }
      }
    },
    () => {
      toast.error("Validation errors occurred");
    },
  );

  const countWords = (val?: string | null) =>
    val ? val.trim().split(/\s+/).filter(Boolean).length : 0;

  const focusCommentField = (
    fieldKey: "initial_message" | "admin_reply_message",
    start: number,
    end: number,
  ) => {
    requestAnimationFrame(() => {
      const input = commentRefs.current[fieldKey];
      if (!input) return;
      input.focus();
      input.setSelectionRange(start, end);
    });
  };

  const applyCommentFormatting = (
    fieldKey: "initial_message" | "admin_reply_message",
    formatter: (selectedText: string) => {
      nextText: string;
      selectionStart: number;
      selectionEnd: number;
    },
  ) => {
    const input = commentRefs.current[fieldKey];
    if (!input) return;

    const currentValue = form.getValues(fieldKey) ?? "";
    const selectionStart = input.selectionStart ?? currentValue.length;
    const selectionEnd = input.selectionEnd ?? currentValue.length;
    const selectedText = currentValue.slice(selectionStart, selectionEnd);

    const { nextText, selectionStart: nextStart, selectionEnd: nextEnd } =
      formatter(selectedText);

    const updatedValue =
      currentValue.slice(0, selectionStart) +
      nextText +
      currentValue.slice(selectionEnd);

    form.setValue(fieldKey, updatedValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    focusCommentField(fieldKey, selectionStart + nextStart, selectionStart + nextEnd);
  };

  const commentToolbarButtons = (
    fieldKey: "initial_message" | "admin_reply_message",
  ) => (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          applyCommentFormatting(fieldKey, (selectedText) => {
            const text = selectedText || "bold text";
            return {
              nextText: `**${text}**`,
              selectionStart: 2,
              selectionEnd: 2 + text.length,
            };
          })
        }
      >
        Bold
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          applyCommentFormatting(fieldKey, (selectedText) => {
            const text = selectedText || "italic text";
            return {
              nextText: `*${text}*`,
              selectionStart: 1,
              selectionEnd: 1 + text.length,
            };
          })
        }
      >
        Italic
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          applyCommentFormatting(fieldKey, (selectedText) => {
            const text = selectedText || "note";
            return {
              nextText: `\`${text}\``,
              selectionStart: 1,
              selectionEnd: 1 + text.length,
            };
          })
        }
      >
        Code
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          applyCommentFormatting(fieldKey, (selectedText) => {
            const block = selectedText || "First item\nSecond item";
            const bulleted = block
              .split(/\r?\n/)
              .map((line) => (line.trim() ? `- ${line.replace(/^\s*[-*]\s+/, "")}` : line))
              .join("\n");

            return {
              nextText: bulleted,
              selectionStart: 0,
              selectionEnd: bulleted.length,
            };
          })
        }
      >
        Bullets
      </Button>
      <span className="text-[11px] text-slate-500">
        Supports `**bold**`, `*italic*`, `- bullet`, and `` `code` ``.
      </span>
    </div>
  );

  const WORD_LIMITS: Record<string, number> = {
    initial_message: 3000,
    admin_reply_message: 3000,
  };

  const threadTimeline = useMemo(() => {
    const items: Array<{
      key: string;
      authorRole: "User" | "Admin";
      responder: string;
      message: string;
      timestamp: string | null;
    }> = [];

    threadMessages.forEach((message) => {
      const responder =
        message.created_by ||
        (message.author_role === "Admin" ? "Admin" : "User");

      items.push({
        key: `thread-${message.id}`,
        authorRole: message.author_role,
        responder,
        message: message.message,
        timestamp: message.created_at,
      });
    });

    return items;
  }, [threadMessages]);

  const handleThreadReplySubmit = async () => {
    const feedbackId = Number(initialValues?.id);
    if (!feedbackId || !threadReply.trim()) return;

    setSendingThreadReply(true);
    const result = await addFeedbackThreadMessage({
      feedbackId,
      message: threadReply,
      submitterEmail: initialValues?.email || form.getValues("email"),
    });

    if (!result.success) {
      toast.error(result.message);
      setSendingThreadReply(false);
      return;
    }

    setThreadMessages(result.data);
    setThreadReply("");
    toast.success(result.message);
    refetchTable?.();
    setSendingThreadReply(false);
  };

  const shape = baseFeedbackSchema.shape as ZodRawShape;
  const renderFormField = (
    fieldKey: string,
    label?: string,
    tooltip?: string,
  ) => {
    const schemaType = shape[fieldKey] as ZodTypeAny;
    const isBoolean = schemaType?.safeParse?.(true)?.success;
    const isFK = fkFields.includes(fieldKey);
    const isCommentField =
      fieldKey === "initial_message" || fieldKey === "admin_reply_message";
    const isAdminCommentField = fieldKey === "admin_reply_message";
    const isReadOnlyField = isReplyOnlyMode;
    const isLockedPromotedField =
      fieldKey === "promote" &&
      (initialValues?.promote === true || form.getValues("promote") === true);
    const isDisabledField = isReadOnlyField || isLockedPromotedField;

    const displayLabel = label ?? fieldKey.replaceAll("_", " ");

    return (
      <FormField
        key={fieldKey}
        control={form.control}
        name={fieldKey as keyof FeedbackFormData}
        render={({ field }) => (
          <FormItem
            className={
              fieldKey === "draft"
                ? "flex flex-row items-center space-x-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                : "space-y-1.5"
            }
          >
            {loadingStatus === "loading" && <Loading />}
            <FormLabel className="mt-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              {tooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 cursor-pointer text-slate-400 hover:text-cyan-700" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm text-sm leading-relaxed whitespace-pre-line space-y-2">
                      {tooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

              )}
              <span>{displayLabel}</span>
              {showRequiredFieldsIcon.includes(fieldKey) && (
                <Asterisk className="w-3 h-3 text-red-400" />
              )}
            </FormLabel>
            {isBoolean ? (
              <FormControl>
                <label
                  className={`relative inline-block h-7 w-14 ${
                    isDisabledField ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    disabled={isDisabledField}
                    className="peer sr-only"
                  />
                  <div className="h-full w-full rounded-full bg-slate-200 transition-colors peer-checked:bg-cyan-800">
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 pl-1 text-[10px] font-bold text-white transition-opacity peer-checked:opacity-0">
                      Yes
                    </span>
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 pr-1 text-[10px] font-bold text-slate-500 transition-opacity peer-checked:opacity-0">
                      No
                    </span>
                  </div>
                  <div className="absolute left-0 top-0 h-7 w-7 rounded-full border border-slate-300 bg-white shadow-sm transition-transform peer-checked:translate-x-7" />
                </label>
              </FormControl>
            ) : isFK ? (
              <FormControl>
                <Select
                  options={foreignOptions[fieldKey] ?? []}
                  value={
                    (foreignOptions[fieldKey] ?? []).find(
                      (opt) => String(opt.value) === String(field.value),
                    ) ?? null
                  }
                  onChange={(opt) =>
                    field.onChange(opt ? Number(opt.value) : null)
                  }
                  isDisabled={isDisabledField}
                  className="text-sm"
                />
              </FormControl>
            ) : (
              <>
                <FormControl>
                  {isCommentField ? (
                    <div className="space-y-2">
                      {commentToolbarButtons(
                        fieldKey as "initial_message" | "admin_reply_message",
                      )}
                      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
                        <div className="min-w-0">
                          <Textarea
                            ref={(element) => {
                              commentRefs.current[
                                fieldKey as "initial_message" | "admin_reply_message"
                              ] = element;
                            }}
                            value={typeof field.value === "string" ? field.value : ""}
                            onChange={(e) => field.onChange(e.target.value)}
                            rows={isAdminCommentField ? 5 : 8}
                            disabled={isDisabledField}
                            className={`rounded-md border-slate-200 bg-white text-sm ${
                              isAdminCommentField
                                ? "h-[110px] max-h-[110px] resize-none"
                                : "h-[150px] max-h-[150px] resize-none"
                            }`}
                            placeholder="Add your comment. Minimal formatting is supported."
                          />
                        </div>
                        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            Preview
                          </div>
                          <div
                            className={`overflow-y-auto pr-1 ${isAdminCommentField
                              ? "h-[110px] max-h-[110px]"
                              : "h-[150px] max-h-[150px]"
                              }`}
                          >
                            <FeedbackCommentContent value={field.value as string | null} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <input
                      type={fieldKey === "email" ? "email" : "text"}
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      disabled={isDisabledField}
                      className={`
                      w-full rounded-md border px-3 py-2 text-sm transition
                      ${isDisabledField
                          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 opacity-80"
                          : "border-slate-300 bg-white/90 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-700"}
                    `}
                    />
                  )}
                </FormControl>
                {WORD_LIMITS[fieldKey] && (
                  <div className="mt-1 text-[11px] text-gray-500 text-right">
                    {countWords(field.value as string | null)} /{" "}
                    {WORD_LIMITS[fieldKey]} words
                  </div>
                )}
                {fieldKey === "promote" && isLockedPromotedField && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Promote is locked after activation.
                  </div>
                )}
              </>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Form {...form}>
      <form
        onSubmit={submitData}
        className="space-y-4 p-3 md:p-4"
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
            Submission Details
          </p>
          <p className="mt-1 text-xs leading-6 text-slate-600">
            Provide enough context for reviewers to understand the issue quickly, while avoiding personally identifiable information in any message content.
          </p>
        </div>

        <FeedbackRenderPanel
          renderFormField={renderFormField}
          isAdmin={isAdmin}
          isEditMode={isEditMode}
        />

        {isEditMode && initialValues?.id && (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 md:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Discussion Thread
                </h3>
                <p className="text-xs text-red-500">
                  Please avoid including any personally identifiable information (PII) in the thread messages.
                </p>
              </div>
              <div className="text-xs font-medium text-slate-500">
                Status: {initialValues.feedback_status_name || "Open"}
              </div>
            </div>

            <div className="max-h-[140px] space-y-2 overflow-y-auto pr-1">
              {threadLoading ? (
                <div className="text-sm text-slate-500">Loading thread...</div>
              ) : threadTimeline.length > 0 ? (
                threadTimeline.map((item) => (
                  <div
                    key={item.key}
                    className={`rounded-lg border p-2.5 ${item.authorRole === "Admin"
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-white"
                      }`}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                          {item.authorRole}
                        </span>
                        <span>
                          <span className="font-medium">By:</span>{" "}
                          <span>{item.responder}</span>
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Created:</span>{" "}
                        <span>
                          {item.timestamp ? formatDateTime(item.timestamp) : "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                      <FeedbackCommentContent value={item.message} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">
                  No follow-up replies yet.
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-700">
                  Add Reply
                </div>
                {isClosedFeedback && (
                  <div className="text-xs font-medium text-amber-600">
                    Replies are disabled because this feedback is closed.
                  </div>
                )}
              </div>
              <Textarea
                value={threadReply}
                onChange={(e) => setThreadReply(e.target.value)}
                rows={3}
                disabled={isClosedFeedback || sendingThreadReply}
                className="h-[80px] max-h-[80px] resize-none rounded-md border-slate-200 bg-white"
                placeholder={
                  isClosedFeedback
                    ? "This feedback is closed."
                    : "Write a reply to continue the discussion..."
                }
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleThreadReplySubmit}
                  disabled={
                    isClosedFeedback ||
                    sendingThreadReply ||
                    !threadReply.trim()
                  }
                >
                  {sendingThreadReply ? "Sending..." : "Add Reply"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {isReplyOnlyMode ? "Close" : "Cancel"}
          </Button>
          {!isReplyOnlyMode && (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Processing..."
                : isAdmin && isDraft
                  ? "Save Draft"
                  : isEditMode
                    ? "Update Feedback"
                    : "Create Feedback"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
