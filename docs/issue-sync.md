# Issue Sync

Promoted feedback can be mirrored to external issue trackers.

- GitLab sync is enabled when both `GITLAB_REPORTING_PROJECT_ID` and `GITLAB_ISSUES_REPORTING_TOKEN` are set.
- GitHub sync is enabled when `GITHUB_REPORTING_OWNER`, `GITHUB_REPORTING_REPO`, and `GITHUB_ISSUES_REPORTING_TOKEN` are set.
- If both GitLab and GitHub are configured, promoted feedback syncs to both.
- Promotion creates one issue per feedback item, uses the first thread message as the initial issue body, and syncs later replies as notes/comments.
- Closing or reopening promoted feedback updates the linked issue state.
- Admin promote/close/draft/status actions wait for external sync and return an error if a configured platform fails.

## Configuration

```env
GITLAB_REPORTING_PROJECT_ID=group/project
GITLAB_ISSUES_REPORTING_TOKEN=glpat-...

GITHUB_REPORTING_OWNER=your-org
GITHUB_REPORTING_REPO=your-repo
GITHUB_ISSUES_REPORTING_TOKEN=github_pat_...
```

## Testing GitHub Sync

To test GitHub issue sync locally, configure:

```env
GITHUB_REPORTING_OWNER=your-org
GITHUB_REPORTING_REPO=your-repo
GITHUB_ISSUES_REPORTING_TOKEN=github_pat_...
```

Then:

1. Start the app with `npm run dev`.
2. Create feedback with `POST /api/v1/feedback`.
3. Promote it with `PATCH /api/v1/admin/feedback/:id` and `{"action":"promote","value":"yes"}`.
4. Add a reply and confirm it appears as a GitHub issue comment.
5. Close the feedback and confirm the GitHub issue closes.
