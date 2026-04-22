// Components
export { FeedbackWidget } from "./components/FeedbackWidget";
export { FeedbackForm } from "./components/FeedbackForm";
export { FeedbackButton } from "./components/FeedbackButton";
export { AdminPanel } from "./components/AdminPanel";

// Hooks
export { useAdminIdentity } from "./hooks/useAdminIdentity";
export { useFeedbacks } from "./hooks/useFeedbacks";
export { useFormState } from "./hooks/useFormState";

// Types
export type {
  FeedbackData,
  FeedbackThreadMessage,
  ForeignItem,
  FeedbackWidgetConfig,
  AdminPanelConfig,
} from "./types";

// Validation
export { feedbackFormSchema, baseFeedbackSchema } from "./validation/schema";
export type { FeedbackFormData } from "./validation/schema";
