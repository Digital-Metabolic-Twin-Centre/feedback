"use client";
"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AdminPanel: () => AdminPanel,
  FeedbackButton: () => FeedbackButton,
  FeedbackForm: () => FeedbackForm,
  FeedbackWidget: () => FeedbackWidget,
  baseFeedbackSchema: () => baseFeedbackSchema,
  feedbackFormSchema: () => feedbackFormSchema,
  useAdminIdentity: () => useAdminIdentity,
  useFeedbacks: () => useFeedbacks,
  useFormState: () => useFormState
});
module.exports = __toCommonJS(index_exports);

// src/components/FeedbackWidget.tsx
var import_react2 = require("react");

// src/components/FeedbackForm.tsx
var import_react = require("react");
var import_react_hook_form = require("react-hook-form");
var import_zod2 = require("@hookform/resolvers/zod");
var import_sonner = require("sonner");

// src/validation/schema.ts
var import_zod = require("zod");
var zBooleanOptionalFalse = import_zod.z.union([import_zod.z.boolean(), import_zod.z.null(), import_zod.z.undefined()]).transform((val) => val != null ? val : false);
var maxWords = (max) => (val) => {
  if (!val) return true;
  const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
  return wordCount <= max;
};
var baseFeedbackSchema = import_zod.z.object({
  id: import_zod.z.number().optional(),
  email: import_zod.z.string().email("Valid email is required"),
  clinical_site: import_zod.z.number({
    required_error: "Clinical site is required"
  }),
  page: import_zod.z.string().max(500).optional().nullable(),
  initial_message: import_zod.z.string().refine(maxWords(3e3), "Maximum 3000 words").optional().nullable(),
  feedback_type: import_zod.z.number({
    required_error: "Feedback type is required"
  }),
  feedback_status: import_zod.z.number({
    required_error: "Feedback status is required"
  }),
  promote: zBooleanOptionalFalse,
  admin_reply_message: import_zod.z.string().refine(maxWords(3e3), "Maximum 3000 words").optional().nullable(),
  draft: import_zod.z.boolean().default(false),
  soft_delete: import_zod.z.boolean().default(false),
  created_by: import_zod.z.string().nullable().optional(),
  created_at: import_zod.z.string().nullable().optional(),
  updated_by: import_zod.z.string().nullable().optional(),
  updated_at: import_zod.z.string().nullable().optional()
});
var feedbackFormSchema = baseFeedbackSchema.refine(
  (data) => {
    if (data.draft) return true;
    return !!data.email && !!data.clinical_site && !!data.feedback_type && !!data.feedback_status;
  },
  {
    message: "Email, clinical site, feedback type, and feedback status are required before submission.",
    path: ["clinical_site"]
  }
);

// src/lib/apiFetch.ts
async function apiFetch(url, options = {}) {
  var _b;
  const _a = options, { token, apiKey } = _a, rest = __objRest(_a, ["token", "apiKey"]);
  const headers = __spreadValues({
    "Content-Type": "application/json"
  }, (_b = rest.headers) != null ? _b : {});
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (apiKey) headers["x-api-key"] = apiKey;
  return fetch(url, __spreadProps(__spreadValues({}, rest), { headers }));
}

// src/components/FeedbackForm.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function FeedbackForm({
  endpoint,
  metaEndpoint,
  token,
  apiKey,
  defaultPage,
  defaultEmail = "",
  initialValues,
  isAdmin = false,
  onSuccess,
  onClose,
  className
}) {
  var _a, _b, _c, _d, _e, _f, _g;
  const isEditMode = Boolean(initialValues);
  const [typeOptions, setTypeOptions] = (0, import_react.useState)([]);
  const [orgOptions, setOrgOptions] = (0, import_react.useState)([]);
  const [statusOptions, setStatusOptions] = (0, import_react.useState)([]);
  const [metaLoading, setMetaLoading] = (0, import_react.useState)(true);
  const [isSubmitting, setIsSubmitting] = (0, import_react.useState)(false);
  const form = (0, import_react_hook_form.useForm)({
    resolver: (0, import_zod2.zodResolver)(feedbackFormSchema),
    defaultValues: {
      id: initialValues == null ? void 0 : initialValues.id,
      email: (_b = (_a = initialValues == null ? void 0 : initialValues.email) != null ? _a : defaultEmail) != null ? _b : "",
      clinical_site: initialValues == null ? void 0 : initialValues.clinical_site,
      page: (_d = (_c = initialValues == null ? void 0 : initialValues.page) != null ? _c : defaultPage) != null ? _d : "",
      initial_message: "",
      feedback_type: initialValues == null ? void 0 : initialValues.feedback_type,
      feedback_status: initialValues == null ? void 0 : initialValues.feedback_status,
      promote: (_e = initialValues == null ? void 0 : initialValues.promote) != null ? _e : false,
      admin_reply_message: "",
      draft: (_f = initialValues == null ? void 0 : initialValues.draft) != null ? _f : false,
      soft_delete: (_g = initialValues == null ? void 0 : initialValues.soft_delete) != null ? _g : false
    },
    mode: "onChange"
  });
  const fetchMeta = (0, import_react.useCallback)(async () => {
    var _a2, _b2, _c2;
    try {
      setMetaLoading(true);
      const res = await apiFetch(metaEndpoint, { token, apiKey });
      if (!res.ok) throw new Error("Failed to load reference data");
      const json = await res.json();
      const toOption = (item) => {
        var _a3, _b3;
        return {
          value: item.id,
          label: (_b3 = (_a3 = item.label) != null ? _a3 : item.name) != null ? _b3 : String(item.id)
        };
      };
      const types = ((_a2 = json.types) != null ? _a2 : []).map(toOption);
      const orgs = ((_b2 = json.organisations) != null ? _b2 : []).map(toOption);
      const statuses = ((_c2 = json.statuses) != null ? _c2 : []).map(toOption);
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
      import_sonner.toast.error("Failed to load reference data");
    } finally {
      setMetaLoading(false);
    }
  }, [metaEndpoint, token, apiKey, form, isEditMode]);
  (0, import_react.useEffect)(() => {
    fetchMeta();
  }, [fetchMeta]);
  const onSubmit = form.handleSubmit(async (data) => {
    var _a2;
    try {
      setIsSubmitting(true);
      const url = isEditMode && data.id ? `${endpoint}/${data.id}` : endpoint;
      const method = isEditMode ? "PATCH" : "POST";
      const res = await apiFetch(url, { method, body: JSON.stringify(data), token, apiKey });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((_a2 = json.message) != null ? _a2 : "Submission failed");
      }
      import_sonner.toast.success(isEditMode ? "Feedback updated" : "Feedback submitted \u2014 thank you!");
      form.reset();
      onSuccess == null ? void 0 : onSuccess();
      onClose == null ? void 0 : onClose();
    } catch (err) {
      import_sonner.toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  });
  const renderSelect = (name, label, options) => {
    const value = form.watch(name);
    const error = form.formState.errors[name];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "fb-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "fb-label", children: label }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "select",
        {
          className: "fb-select",
          value: String(value != null ? value : ""),
          onChange: (e) => form.setValue(name, Number(e.target.value)),
          disabled: metaLoading,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: "Select\u2026" }),
            options.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: String(opt.value), children: opt.label }, opt.value))
          ]
        }
      ),
      error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "fb-error", children: String(error.message) })
    ] }, name);
  };
  const renderInput = (name, label, type = "text", placeholder) => {
    const error = form.formState.errors[name];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "fb-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "fb-label", children: label }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        __spreadValues({
          type,
          className: "fb-input",
          placeholder
        }, form.register(name))
      ),
      error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "fb-error", children: String(error.message) })
    ] }, name);
  };
  const renderTextarea = (name, label, placeholder) => {
    const error = form.formState.errors[name];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "fb-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "fb-label", children: label }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        __spreadValues({
          className: "fb-textarea",
          rows: 4,
          placeholder
        }, form.register(name))
      ),
      error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "fb-error", children: String(error.message) })
    ] }, name);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { onSubmit, className: `fb-form ${className != null ? className : ""}`, noValidate: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "fb-form-grid", children: [
      renderInput("email", "Email", "email", "your@email.com"),
      renderSelect("clinical_site", "Organisation / Site", orgOptions),
      renderSelect("feedback_type", "Feedback Type", typeOptions),
      renderInput("page", "Page / URL", "text", "e.g. /dashboard")
    ] }),
    !isEditMode && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "fb-message-section", children: renderTextarea(
      isAdmin ? "admin_reply_message" : "initial_message",
      isAdmin ? "Admin Reply" : "Your message",
      "Describe your feedback\u2026"
    ) }),
    isAdmin && isEditMode && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "fb-admin-controls", children: [
      renderSelect("feedback_status", "Status", statusOptions),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "fb-field", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "fb-label", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", __spreadValues({ type: "checkbox" }, form.register("promote"))),
        " ",
        "Promote to GitLab issue"
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "fb-field", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "fb-label", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", __spreadValues({ type: "checkbox" }, form.register("draft"))),
        " ",
        "Draft"
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "fb-form-actions", children: [
      onClose && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "fb-btn fb-btn-secondary", onClick: onClose, children: "Cancel" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", className: "fb-btn fb-btn-primary", disabled: isSubmitting, children: isSubmitting ? "Submitting\u2026" : isEditMode ? "Save Changes" : "Submit Feedback" })
    ] })
  ] });
}

// src/components/FeedbackWidget.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function FeedbackWidget(_a) {
  var _b = _a, {
    buttonLabel = "Feedback",
    buttonClassName,
    modalClassName,
    adminEmails = [],
    currentUserEmail,
    defaultPage
  } = _b, formProps = __objRest(_b, [
    "buttonLabel",
    "buttonClassName",
    "modalClassName",
    "adminEmails",
    "currentUserEmail",
    "defaultPage"
  ]);
  const [open, setOpen] = (0, import_react2.useState)(false);
  const isAdmin = !!currentUserEmail && adminEmails.map((e) => e.toLowerCase()).includes(currentUserEmail.toLowerCase());
  const page = defaultPage != null ? defaultPage : typeof window !== "undefined" ? window.location.pathname : "";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "button",
      {
        className: buttonClassName != null ? buttonClassName : "fb-trigger-btn",
        onClick: () => setOpen(true),
        "aria-label": buttonLabel,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: buttonLabel })
        ]
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "fb-modal-overlay", role: "dialog", "aria-modal": "true", onClick: (e) => {
      if (e.target === e.currentTarget) setOpen(false);
    }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: `fb-modal ${modalClassName != null ? modalClassName : ""}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "fb-modal-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { className: "fb-modal-title", children: "Submit Feedback" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "fb-modal-close", onClick: () => setOpen(false), "aria-label": "Close", children: "\u2715" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "fb-modal-body", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        FeedbackForm,
        __spreadProps(__spreadValues({}, formProps), {
          defaultPage: page,
          defaultEmail: currentUserEmail,
          isAdmin,
          onClose: () => setOpen(false)
        })
      ) })
    ] }) })
  ] });
}

// src/components/FeedbackButton.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function FeedbackButton({ onClick, label = "Feedback", className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "button",
    {
      className: className != null ? className : "fb-trigger-btn",
      onClick,
      "aria-label": label,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: label })
      ]
    }
  );
}

// src/components/AdminPanel.tsx
var import_react4 = require("react");

// src/hooks/useFeedbacks.ts
var import_react3 = require("react");
function useFeedbacks({ endpoint, adminEmail, token, apiKey, enabled = true }) {
  const [feedbacks, setFeedbacks] = (0, import_react3.useState)([]);
  const [loading, setLoading] = (0, import_react3.useState)(false);
  const [error, setError] = (0, import_react3.useState)(null);
  const buildHeaders = (0, import_react3.useCallback)(() => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (apiKey) headers["x-api-key"] = apiKey;
    return headers;
  }, [token, apiKey]);
  const fetchFeedbacks = (0, import_react3.useCallback)(async () => {
    var _a, _b;
    if (!enabled || !endpoint) return;
    setLoading(true);
    setError(null);
    try {
      const url = adminEmail ? `${endpoint}?__session_email=${encodeURIComponent(adminEmail)}` : endpoint;
      const res = await fetch(url, { headers: buildHeaders() });
      const json = await res.json();
      setFeedbacks((_b = (_a = json.data) != null ? _a : json) != null ? _b : []);
    } catch (e) {
      setError("Failed to load feedbacks.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, adminEmail, buildHeaders, enabled]);
  (0, import_react3.useEffect)(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);
  return { feedbacks, loading, error, refetch: fetchFeedbacks };
}

// src/components/AdminPanel.tsx
var import_sonner2 = require("sonner");
var import_jsx_runtime4 = require("react/jsx-runtime");
var STATUS_LABELS = {
  1: { label: "Open", color: "#1d4ed8" },
  2: { label: "In Progress", color: "#b45309" },
  3: { label: "Pending Review", color: "#6d28d9" },
  4: { label: "Resolved", color: "#15803d" },
  5: { label: "Closed", color: "#475569" },
  6: { label: "Won't Fix", color: "#dc2626" }
};
var STATUS_OPTIONS = [
  { value: 1, label: "Open" },
  { value: 2, label: "In Progress" },
  { value: 3, label: "Pending Review" },
  { value: 4, label: "Resolved" },
  { value: 5, label: "Closed" },
  { value: 6, label: "Won't Fix" }
];
function AdminPanel({
  feedbacksEndpoint,
  formEndpoint,
  metaEndpoint,
  adminEmail,
  token,
  apiKey,
  onPromote,
  className
}) {
  const { feedbacks, loading, error, refetch } = useFeedbacks({
    endpoint: feedbacksEndpoint,
    adminEmail,
    token,
    apiKey,
    enabled: !!adminEmail
  });
  const [actionLoading, setActionLoading] = (0, import_react4.useState)(null);
  const [editFeedback, setEditFeedback] = (0, import_react4.useState)(null);
  const patchFeedback = (0, import_react4.useCallback)(async (id, body) => {
    const res = await apiFetch(`${feedbacksEndpoint}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(__spreadProps(__spreadValues({}, body), { admin_email: adminEmail })),
      token,
      apiKey
    });
    return res.json();
  }, [feedbacksEndpoint, adminEmail, token, apiKey]);
  async function handleAction(id, action, value) {
    var _a;
    if (actionLoading !== null) return;
    setActionLoading(id);
    try {
      const res = await patchFeedback(id, { action, value });
      if (!res.success) {
        import_sonner2.toast.error((_a = res.error) != null ? _a : "Action failed");
      } else {
        await refetch();
        if (action === "promote") {
          const fb = feedbacks.find((f) => f.id === id);
          if (fb) onPromote == null ? void 0 : onPromote(fb);
        }
      }
    } finally {
      setActionLoading(null);
    }
  }
  async function handleDelete(id) {
    if (!window.confirm("Soft-delete this feedback?")) return;
    await handleAction(id, "delete");
  }
  const total = feedbacks.length;
  const openCount = feedbacks.filter((f) => f.feedback_status === 1).length;
  const inProgressCount = feedbacks.filter((f) => f.feedback_status === 2).length;
  if (loading) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "fb-loading", children: "Loading feedbacks\u2026" });
  if (error) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "fb-error-msg", children: error });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: `fb-admin ${className != null ? className : ""}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "fb-admin-summary", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "fb-stat", children: [
        "Total: ",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: total })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "fb-stat fb-stat-open", children: [
        "Open: ",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: openCount })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "fb-stat fb-stat-progress", children: [
        "In Progress: ",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: inProgressCount })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "fb-admin-table-wrapper", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("table", { className: "fb-admin-table", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "Submitter" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "Type" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "Status" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "Page" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "Threads" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "Flags" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "Actions" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tbody", { children: feedbacks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { colSpan: 7, className: "fb-empty", children: "No feedbacks found." }) }) : feedbacks.map((fb) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const statusInfo = (_b = STATUS_LABELS[fb.feedback_status]) != null ? _b : { label: (_a = fb.feedback_status_name) != null ? _a : "\u2014", color: "#475569" };
        const isLoading = actionLoading === fb.id;
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { className: fb.soft_delete ? "fb-row-deleted" : "", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: (_d = (_c = fb.submitter_ref) != null ? _c : fb.email) != null ? _d : "\u2014" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: (_e = fb.feedback_type_name) != null ? _e : "\u2014" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "fb-badge", style: { color: statusInfo.color }, children: statusInfo.label }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "fb-truncate", children: (_f = fb.page) != null ? _f : "\u2014" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "fb-center", children: (_g = fb.thread_count) != null ? _g : 0 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: fb.promote && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "fb-badge", children: "\u2B50 Promoted" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "fb-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "select",
              {
                disabled: isLoading,
                value: fb.feedback_status,
                onChange: (e) => handleAction(fb.id, "status", parseInt(e.target.value, 10)),
                className: "fb-select-sm",
                children: STATUS_OPTIONS.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: opt.value, children: opt.label }, opt.value))
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "fb-btn-sm", disabled: isLoading || fb.feedback_status === 5, onClick: () => handleAction(fb.id, "close"), children: "Close" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "fb-btn-sm", disabled: isLoading || Boolean(fb.promote), onClick: () => handleAction(fb.id, "promote"), children: "Promote" }),
            fb.soft_delete ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "fb-btn-sm fb-btn-restore", disabled: isLoading, onClick: () => handleAction(fb.id, "restore"), children: "Restore" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "fb-btn-sm fb-btn-danger", disabled: isLoading, onClick: () => handleDelete(fb.id), children: "Delete" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "fb-btn-sm", disabled: isLoading, onClick: () => setEditFeedback(fb), children: "Edit" })
          ] }) })
        ] }, fb.id);
      }) })
    ] }) }),
    editFeedback && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "fb-modal-overlay", role: "dialog", "aria-modal": "true", onClick: (e) => {
      if (e.target === e.currentTarget) setEditFeedback(null);
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "fb-modal", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "fb-modal-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("h2", { className: "fb-modal-title", children: [
          "Edit Feedback #",
          editFeedback.id
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "fb-modal-close", onClick: () => setEditFeedback(null), "aria-label": "Close", children: "\u2715" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "fb-modal-body", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        FeedbackForm,
        {
          endpoint: formEndpoint,
          metaEndpoint,
          token,
          apiKey,
          initialValues: editFeedback,
          isAdmin: true,
          onClose: () => setEditFeedback(null),
          onSuccess: async () => {
            setEditFeedback(null);
            await refetch();
          }
        }
      ) })
    ] }) })
  ] });
}

// src/hooks/useAdminIdentity.ts
var import_react5 = require("react");
var STORAGE_KEY = "feedback_identity_email";
function useAdminIdentity(adminEmails = []) {
  const [email, setEmail] = (0, import_react5.useState)("");
  const [isAdmin, setIsAdmin] = (0, import_react5.useState)(false);
  const [mounted, setMounted] = (0, import_react5.useState)(false);
  (0, import_react5.useEffect)(() => {
    var _a;
    const saved = (_a = localStorage.getItem(STORAGE_KEY)) != null ? _a : "";
    setEmail(saved);
    setIsAdmin(adminEmails.map((e) => e.toLowerCase()).includes(saved.trim().toLowerCase()));
    setMounted(true);
  }, []);
  const identify = (0, import_react5.useCallback)((newEmail) => {
    const trimmed = newEmail.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setEmail(trimmed);
    setIsAdmin(adminEmails.map((e) => e.toLowerCase()).includes(trimmed.toLowerCase()));
  }, [adminEmails]);
  const clearIdentity = (0, import_react5.useCallback)(() => {
    localStorage.removeItem(STORAGE_KEY);
    setEmail("");
    setIsAdmin(false);
  }, []);
  return { email, isAdmin, identify, clearIdentity, mounted };
}

// src/hooks/useFormState.ts
var import_react6 = require("react");
function useFormState() {
  const [loadingStatus, setLoadingStatus] = (0, import_react6.useState)("idle");
  const [errorMessage, setErrorMessage] = (0, import_react6.useState)(null);
  return { loadingStatus, setLoadingStatus, errorMessage, setErrorMessage };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AdminPanel,
  FeedbackButton,
  FeedbackForm,
  FeedbackWidget,
  baseFeedbackSchema,
  feedbackFormSchema,
  useAdminIdentity,
  useFeedbacks,
  useFormState
});
//# sourceMappingURL=index.js.map