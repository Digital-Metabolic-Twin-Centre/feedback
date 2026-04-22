export const fkFields: string[] = [
  "clinical_site",
  "feedback_type",
  "feedback_status",
];

export const showRequiredFieldsIcon: string[] = [
  "email",
  "clinical_site",
  "feedback_type",
  "feedback_status",
];

export const feedbackFormLabelsMap: Record<string, string> = {
  email: "Email",
  clinical_site: "Clinical Site",
  page: "Page",
  initial_message: "Initial Message",
  feedback_type: "Feedback Type",
  feedback_status: "Feedback Status",
  promote: "Make GitLab Issue",
  admin_reply_message: "Admin Reply",
  draft: "Save as Draft",
};

export const feedbackFormTooltip: Record<string, string> = {
  email: "Email address of the user who submitted the feedback.",
  clinical_site:
    "Team, workspace, or organisation associated with the feedback.",
  page: "Page or route where the feedback was submitted from.",
  initial_message: "First message that starts the feedback thread.",
  feedback_type: "Category of the submitted feedback.",
  feedback_status: "Current review status of the feedback item.",
  promote: "Mark this feedback for promotion or prioritisation.",
  admin_reply_message: "Opening admin reply used when starting a thread as an admin.",
  draft: "Save this feedback entry as a draft.",
};
