import React from "react";
import { FeedbackFormData } from "../validation/schema";
import {
  feedbackFormLabelsMap,
  feedbackFormTooltip,
} from "../utils/feedback-config";

type RenderFormField = (
  fieldKey: keyof FeedbackFormData | string,
  label?: string,
  tooltip?: string,
) => React.ReactNode;

type Props = {
  renderFormField: RenderFormField;
  isAdmin: boolean;
  isEditMode: boolean;
};

export const FeedbackRenderPanel = ({
  renderFormField,
  isAdmin,
  isEditMode,
}: Props) => {
  const createMessageField = isAdmin ? "admin_reply_message" : "initial_message";

  return (
    <div className="mx-auto space-y-4">
      {/* Always-visible fields */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {renderFormField(
          "email",
          feedbackFormLabelsMap.email,
          feedbackFormTooltip.email,
        )}

        {renderFormField(
          "clinical_site",
          feedbackFormLabelsMap.clinical_site,
          feedbackFormTooltip.clinical_site,
        )}

        {(!isAdmin || !isEditMode) &&
          renderFormField(
            "feedback_type",
            feedbackFormLabelsMap.feedback_type,
            feedbackFormTooltip.feedback_type,
          )}

        {renderFormField(
          "page",
          feedbackFormLabelsMap.page,
          feedbackFormTooltip.page,
        )}
      </div>

      {(!isAdmin || !isEditMode) && !isEditMode && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 md:p-4">
          {renderFormField(
            createMessageField,
            feedbackFormLabelsMap[createMessageField],
            feedbackFormTooltip[createMessageField],
          )}
        </div>
      )}

      {isAdmin && isEditMode && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {renderFormField(
              "feedback_status",
              feedbackFormLabelsMap.feedback_status,
              feedbackFormTooltip.feedback_status,
            )}

            {renderFormField(
              "promote",
              feedbackFormLabelsMap.promote,
              feedbackFormTooltip.promote,
            )}
            {renderFormField(
              "draft",
              feedbackFormLabelsMap.draft,
              feedbackFormTooltip.draft,
            )}
          </div>
        </div>
      )}
    </div>
  );
};
