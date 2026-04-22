export const SITE_PATHS = {
  HOMEPAGE: "/",
  TOO_MANY_REQUESTS: "/429",
  UNAUTHORIZED: "/unauthorized",
  FEEDBACKS: "/feedbacks",
  ADMIN: "/admin",
} as const;

export const NO_AUTH_BUTTONS: string[] = [
  "/api/auth",
  "/unauthorized",
  "/429",
];

export const ECRFS_LINKS: string[] = [
  "/ecrfs/",
  "/ecrf/",
];


export const API_ENDPOINTS = {
  LOGOUT: "/api/auth/logout",
  SELECT: "/api/select",
  SELECT_MULTIPLE: "/api/select/multiple",
  CREATE: "/api/create",
  DELETE: "/api/delete",
  UPDATE: "/api/update",
  CENTRAL_RESOURCES: "/api/central-resources",
  NOTIFICATION: "/api/notification",
  ADMIN_FEEDBACKS: "/api/admin/feedbacks",
  V1_FEEDBACKS: "/api/v1/feedbacks",
  V1_FEEDBACKS_META: "/api/v1/feedbacks/meta",
  V1_ADMIN_FEEDBACKS: "/api/v1/admin/feedbacks",
  V1_OPENAPI: "/api/v1/openapi.json",
  V1_DOCS: "/api/v1/docs",
} as const;
