import { z } from "zod";

const zBooleanOptionalFalse = z
  .union([z.boolean(), z.null(), z.undefined()])
  .transform((val) => val ?? false);

const maxWords =
  (max: number) => (val: string | null | undefined) => {
    if (!val) return true;
    const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
    return wordCount <= max;
  };

export const baseFeedbackSchema = z.object({
  id: z.number().optional(),
  email: z.string().email("Valid email is required"),
  clinical_site: z.number({
    required_error: "Clinical site is required",
  }),
  page: z.string().max(500).optional().nullable(),
  initial_message: z
    .string()
    .refine(maxWords(3000), "Maximum 3000 words")
    .optional()
    .nullable(),
  feedback_type: z.number({
    required_error: "Feedback type is required",
  }),
  feedback_status: z.number({
    required_error: "Feedback status is required",
  }),
  promote: zBooleanOptionalFalse,
  admin_reply_message: z
    .string()
    .refine(maxWords(3000), "Maximum 3000 words")
    .optional()
    .nullable(),
  draft: z.boolean().default(false),
  soft_delete: z.boolean().default(false),
  created_by: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export const feedbackFormSchema = baseFeedbackSchema.refine(
  (data) => {
    if (data.draft) return true;
    return (
      !!data.email &&
      !!data.clinical_site &&
      !!data.feedback_type &&
      !!data.feedback_status
    );
  },
  {
    message:
      "Email, clinical site, feedback type, and feedback status are required before submission.",
    path: ["clinical_site"],
  }
);

export type FeedbackFormData = z.infer<typeof feedbackFormSchema>;
