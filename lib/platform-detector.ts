import { env } from "@/lib/env-validation";

export type Platform = "gitlab" | "github";

/**
 * Detects which platforms are available based on environment configuration
 */
export function getAvailablePlatforms(): Platform[] {
  const platforms: Platform[] = [];

  // Check GitLab configuration
  if (env.GITLAB_ISSUES_REPORTING_TOKEN && env.GITLAB_REPORTING_PROJECT_ID) {
    platforms.push("gitlab");
  }

  // Check GitHub configuration
  if (env.GITHUB_ISSUES_REPORTING_TOKEN && env.GITHUB_REPORTING_OWNER && env.GITHUB_REPORTING_REPO) {
    platforms.push("github");
  }

  return platforms;
}

/**
 * Checks if a specific platform is available
 */
export function isPlatformAvailable(platform: Platform): boolean {
  switch (platform) {
    case "gitlab":
      return !!(env.GITLAB_ISSUES_REPORTING_TOKEN && env.GITLAB_REPORTING_PROJECT_ID);
    case "github":
      return !!(env.GITHUB_ISSUES_REPORTING_TOKEN && env.GITHUB_REPORTING_OWNER && env.GITHUB_REPORTING_REPO);
    default:
      return false;
  }
}

/**
 * Gets the list of platforms to promote to, based on availability
 * Only returns platforms that are actually configured
 */
export function getPlatformsToPromoteTo(): Platform[] {
  return getAvailablePlatforms();
}
