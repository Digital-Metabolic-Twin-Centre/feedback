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
} as const;

