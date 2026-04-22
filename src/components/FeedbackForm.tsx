"use client";
import React, { useEffect, useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { feedbackFormSchema, type FeedbackFormData } from "../validation/schema";
import type { FeedbackData, ForeignItem } from "../types";
import { apiFetch } from "../lib/apiFetch";

export interface FeedbackFormProps {
  endpoint?: string;
  metaEndpoint?: string;
  token?: string;
  apiKey?: string;
  defaultPage?: string;
  defaultEmail?: string;
  initialValues?: Partial<FeedbackData>;
  isAdmin?: boolean;
  onSuccess?: () => void;
  onClose?: () => void;
  className?: string;
}

interface ForeignOption { value: number | string; label: string; }
interface MetaData {
  types?: ForeignItem[];
  organisations?: ForeignItem[];
  statuses?: ForeignItem[];
}

export function FeedbackForm({
  endpoint = "/api/v1/feedbacks",
  metaEndpoint = "/api/v1/feedbacks/meta",
  token,
  apiKey,
  defaultPage,
  defaultEmail = "",
  initialValues,
  isAdmin = false,
  onSuccess,
  onClose,
  className,
}: FeedbackFormProps) {
  const isEditMode = Boolean(initialValues);

  const [typeOptions, setTypeOptions] = useState<ForeignOption[]>([]);
  const [orgOptions, setOrgOptions] = useState<ForeignOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<ForeignOption[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      id: initialValues?.id,
      email: initialValues?.email ?? defaultEmail ?? "",
      clinical_site: initialValues?.clinical_site,
      page: initialValues?.page ?? defaultPage ?? "",
      initial_message: "",
      feedback_type: initialValues?.feedback_type,
      feedback_status: initialValues?.feedback_status,
      promote: initialValues?.promote ?? false,
      admin_reply_message: "",
      draft: initialValues?.draft ?? false,
      soft_delete: initialValues?.soft_delete ?? false,
    },
    mode: "onChange",
  });

  const fetchMeta = useCallback(async () => {
    try {
      setMetaLoading(true);
      const res = await apiFetch(metaEndpoint, { token, apiKey });
      if (!res.ok) throw new Error("Failed to load reference data");
      const json: MetaData = await res.json();

      const toOption = (item: ForeignItem): ForeignOption => ({
        value: item.id,
        label: item.label ?? item.name ?? String(item.id),
      });

      const types = (json.types ?? []).map(toOption);
      const orgs = (json.organisations ?? []).map(toOption);
      const statuses = (json.statuses ?? []).map(toOption);

      setTypeOptions(types);
      setOrgOptions(orgs);
      setStatusOptions(statuses);

      if (!isEditMode) {
        if (orgs[0] && !form.getValues("clinical_site")) form.setValue("clinical_site", Number(orgs[0].value));
        if (types[0] && !form.getValues("feedback_type")) form.setValue("feedback_type", Number(types[0].value));
        if (statuses[0] && !form.getValues("feedback_status")) form.setValue("feedback_status", Number(statuses[0].value));
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load reference data");
    } finally {
      setMetaLoading(false);
    }
  }, [metaEndpoint, token, apiKey, form, isEditMode]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const onSubmit = form.handleSubmit(async (data: FeedbackFormData) => {
    try {
      setIsSubmitting(true);
      const url = isEditMode && data.id ? `${endpoint}/${data.id}` : endpoint;
      const method = isEditMode ? "PATCH" : "POST";
      const res = await apiFetch(url, { method, body: JSON.stringify(data), token, apiKey });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { message?: string; error?: string }).error ?? (json as { message?: string }).message ?? "Submission failed");
      }
      toast.success(isEditMode ? "Feedback updated" : "Feedback submitted — thank you!");
      form.reset();
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  });

  const renderSelect = (
    name: keyof FeedbackFormData,
    label: string,
    options: ForeignOption[]
  ) => {
    const value = form.watch(name);
    const error = form.formState.errors[name];
    return (
      <div className="fb-field" key={name}>
        <label className="fb-label">{label}</label>
        <select
          className="fb-select"
          value={String(value ?? "")}
          onChange={e => form.setValue(name as never, Number(e.target.value) as never)}
          disabled={metaLoading}
        >
          <option value="">Select…</option>
          {options.map(opt => (
            <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
          ))}
        </select>
        {error && <span className="fb-error">{String(error.message)}</span>}
      </div>
    );
  };

  const renderInput = (
    name: keyof FeedbackFormData,
    label: string,
    type: string = "text",
    placeholder?: string
  ) => {
    const error = form.formState.errors[name];
    return (
      <div className="fb-field" key={name}>
        <label className="fb-label">{label}</label>
        <input
          type={type}
          className="fb-input"
          placeholder={placeholder}
          {...form.register(name as never)}
        />
        {error && <span className="fb-error">{String(error.message)}</span>}
      </div>
    );
  };

  const renderTextarea = (name: keyof FeedbackFormData, label: string, placeholder?: string) => {
    const error = form.formState.errors[name];
    return (
      <div className="fb-field" key={name}>
        <label className="fb-label">{label}</label>
        <textarea
          className="fb-textarea"
          rows={4}
          placeholder={placeholder}
          {...form.register(name as never)}
        />
        {error && <span className="fb-error">{String(error.message)}</span>}
      </div>
    );
  };

  return (
    <form onSubmit={onSubmit} className={`fb-form ${className ?? ""}`} noValidate>
      <div className="fb-form-grid">
        {renderInput("email", "Email", "email", "your@email.com")}
        {renderSelect("clinical_site", "Organisation / Site", orgOptions)}
        {renderSelect("feedback_type", "Feedback Type", typeOptions)}
        {renderInput("page", "Page / URL", "text", "e.g. /dashboard")}
      </div>

      {!isEditMode && (
        <div className="fb-message-section">
          {renderTextarea(
            isAdmin ? "admin_reply_message" : "initial_message",
            isAdmin ? "Admin Reply" : "Your message",
            "Describe your feedback…"
          )}
        </div>
      )}

      {isAdmin && isEditMode && (
        <div className="fb-admin-controls">
          {renderSelect("feedback_status", "Status", statusOptions)}
          <div className="fb-field">
            <label className="fb-label">
              <input type="checkbox" {...form.register("promote")} />
              {" "}Promote to GitLab issue
            </label>
          </div>
          <div className="fb-field">
            <label className="fb-label">
              <input type="checkbox" {...form.register("draft")} />
              {" "}Draft
            </label>
          </div>
        </div>
      )}

      <div className="fb-form-actions">
        {onClose && (
          <button type="button" className="fb-btn fb-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        )}
        <button type="submit" className="fb-btn fb-btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : isEditMode ? "Save Changes" : "Submit Feedback"}
        </button>
      </div>
    </form>
  );
}
