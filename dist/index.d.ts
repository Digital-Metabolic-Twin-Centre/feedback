import * as react_jsx_runtime from 'react/jsx-runtime';
import * as react from 'react';
import { z } from 'zod';

type ForeignItem = {
    id: number | string;
    name?: string;
    label?: string;
    code?: string;
    order?: number | string;
};
interface FeedbackData {
    id: number;
    email: string | null;
    submitter_ref: string | null;
    clinical_site: number;
    clinical_site_name?: string | null;
    page: string | null;
    feedback_type: number;
    feedback_type_name?: string | null;
    feedback_status: number;
    feedback_status_name?: string | null;
    promote: boolean | null;
    thread_count?: number | null;
    latest_thread_message?: string | null;
    latest_thread_author_role?: "User" | "Admin" | null;
    draft: boolean | null;
    soft_delete: boolean | null;
    created_by: string | null;
    created_at: string | null;
    updated_by: string | null;
    updated_at: string | null;
}
interface FeedbackThreadMessage {
    id: number;
    feedback_id: number;
    author_role: "User" | "Admin";
    message: string;
    created_by: string | null;
    created_at: string | null;
    updated_by: string | null;
    updated_at: string | null;
}
interface FeedbackWidgetConfig {
    endpoint: string;
    metaEndpoint: string;
    token?: string;
    apiKey?: string;
}
interface AdminPanelConfig {
    feedbacksEndpoint: string;
    adminEmail: string;
    token?: string;
    apiKey?: string;
}

interface FeedbackFormProps {
    endpoint: string;
    metaEndpoint: string;
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
declare function FeedbackForm({ endpoint, metaEndpoint, token, apiKey, defaultPage, defaultEmail, initialValues, isAdmin, onSuccess, onClose, className, }: FeedbackFormProps): react_jsx_runtime.JSX.Element;

interface FeedbackWidgetProps extends Omit<FeedbackFormProps, "onClose" | "isAdmin"> {
    buttonLabel?: string;
    buttonClassName?: string;
    modalClassName?: string;
    adminEmails?: string[];
    currentUserEmail?: string;
}
declare function FeedbackWidget({ buttonLabel, buttonClassName, modalClassName, adminEmails, currentUserEmail, defaultPage, ...formProps }: FeedbackWidgetProps): react_jsx_runtime.JSX.Element;

interface FeedbackButtonProps {
    onClick: () => void;
    label?: string;
    className?: string;
}
declare function FeedbackButton({ onClick, label, className }: FeedbackButtonProps): react_jsx_runtime.JSX.Element;

interface AdminPanelProps {
    feedbacksEndpoint: string;
    formEndpoint: string;
    metaEndpoint: string;
    adminEmail: string;
    token?: string;
    apiKey?: string;
    onPromote?: (feedback: FeedbackData) => void;
    className?: string;
}
declare function AdminPanel({ feedbacksEndpoint, formEndpoint, metaEndpoint, adminEmail, token, apiKey, onPromote, className, }: AdminPanelProps): react_jsx_runtime.JSX.Element;

declare function useAdminIdentity(adminEmails?: string[]): {
    email: string;
    isAdmin: boolean;
    identify: (newEmail: string) => void;
    clearIdentity: () => void;
    mounted: boolean;
};

interface UseFeedbacksOptions {
    endpoint: string;
    adminEmail?: string;
    token?: string;
    apiKey?: string;
    enabled?: boolean;
}
declare function useFeedbacks({ endpoint, adminEmail, token, apiKey, enabled }: UseFeedbacksOptions): {
    feedbacks: FeedbackData[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
};

type LoadingStatus = "idle" | "loading" | "success" | "error";
declare function useFormState(): {
    loadingStatus: LoadingStatus;
    setLoadingStatus: react.Dispatch<react.SetStateAction<LoadingStatus>>;
    errorMessage: string | null;
    setErrorMessage: react.Dispatch<react.SetStateAction<string | null>>;
};

declare const baseFeedbackSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    email: z.ZodString;
    clinical_site: z.ZodNumber;
    page: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    initial_message: z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>>;
    feedback_type: z.ZodNumber;
    feedback_status: z.ZodNumber;
    promote: z.ZodEffects<z.ZodUnion<[z.ZodBoolean, z.ZodNull, z.ZodUndefined]>, boolean, boolean | null | undefined>;
    admin_reply_message: z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>>;
    draft: z.ZodDefault<z.ZodBoolean>;
    soft_delete: z.ZodDefault<z.ZodBoolean>;
    created_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    created_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updated_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updated_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    clinical_site: number;
    feedback_type: number;
    feedback_status: number;
    promote: boolean;
    draft: boolean;
    soft_delete: boolean;
    id?: number | undefined;
    page?: string | null | undefined;
    initial_message?: string | null | undefined;
    admin_reply_message?: string | null | undefined;
    created_by?: string | null | undefined;
    created_at?: string | null | undefined;
    updated_by?: string | null | undefined;
    updated_at?: string | null | undefined;
}, {
    email: string;
    clinical_site: number;
    feedback_type: number;
    feedback_status: number;
    id?: number | undefined;
    page?: string | null | undefined;
    initial_message?: string | null | undefined;
    promote?: boolean | null | undefined;
    admin_reply_message?: string | null | undefined;
    draft?: boolean | undefined;
    soft_delete?: boolean | undefined;
    created_by?: string | null | undefined;
    created_at?: string | null | undefined;
    updated_by?: string | null | undefined;
    updated_at?: string | null | undefined;
}>;
declare const feedbackFormSchema: z.ZodEffects<z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    email: z.ZodString;
    clinical_site: z.ZodNumber;
    page: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    initial_message: z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>>;
    feedback_type: z.ZodNumber;
    feedback_status: z.ZodNumber;
    promote: z.ZodEffects<z.ZodUnion<[z.ZodBoolean, z.ZodNull, z.ZodUndefined]>, boolean, boolean | null | undefined>;
    admin_reply_message: z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>>;
    draft: z.ZodDefault<z.ZodBoolean>;
    soft_delete: z.ZodDefault<z.ZodBoolean>;
    created_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    created_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updated_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updated_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    clinical_site: number;
    feedback_type: number;
    feedback_status: number;
    promote: boolean;
    draft: boolean;
    soft_delete: boolean;
    id?: number | undefined;
    page?: string | null | undefined;
    initial_message?: string | null | undefined;
    admin_reply_message?: string | null | undefined;
    created_by?: string | null | undefined;
    created_at?: string | null | undefined;
    updated_by?: string | null | undefined;
    updated_at?: string | null | undefined;
}, {
    email: string;
    clinical_site: number;
    feedback_type: number;
    feedback_status: number;
    id?: number | undefined;
    page?: string | null | undefined;
    initial_message?: string | null | undefined;
    promote?: boolean | null | undefined;
    admin_reply_message?: string | null | undefined;
    draft?: boolean | undefined;
    soft_delete?: boolean | undefined;
    created_by?: string | null | undefined;
    created_at?: string | null | undefined;
    updated_by?: string | null | undefined;
    updated_at?: string | null | undefined;
}>, {
    email: string;
    clinical_site: number;
    feedback_type: number;
    feedback_status: number;
    promote: boolean;
    draft: boolean;
    soft_delete: boolean;
    id?: number | undefined;
    page?: string | null | undefined;
    initial_message?: string | null | undefined;
    admin_reply_message?: string | null | undefined;
    created_by?: string | null | undefined;
    created_at?: string | null | undefined;
    updated_by?: string | null | undefined;
    updated_at?: string | null | undefined;
}, {
    email: string;
    clinical_site: number;
    feedback_type: number;
    feedback_status: number;
    id?: number | undefined;
    page?: string | null | undefined;
    initial_message?: string | null | undefined;
    promote?: boolean | null | undefined;
    admin_reply_message?: string | null | undefined;
    draft?: boolean | undefined;
    soft_delete?: boolean | undefined;
    created_by?: string | null | undefined;
    created_at?: string | null | undefined;
    updated_by?: string | null | undefined;
    updated_at?: string | null | undefined;
}>;
type FeedbackFormData = z.infer<typeof feedbackFormSchema>;

export { AdminPanel, type AdminPanelConfig, FeedbackButton, type FeedbackData, FeedbackForm, type FeedbackFormData, type FeedbackThreadMessage, FeedbackWidget, type FeedbackWidgetConfig, type ForeignItem, baseFeedbackSchema, feedbackFormSchema, useAdminIdentity, useFeedbacks, useFormState };
