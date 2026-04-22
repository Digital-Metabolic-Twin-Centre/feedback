# Usage Example

## Install
```bash
npm install feedbacks-dmtc
```

## Add the widget to your app
```tsx
import { FeedbackWidget } from "feedbacks-dmtc";
import "feedbacks-dmtc/styles";

export default function App() {
  return (
    <>
      {/* Your app */}
      <FeedbackWidget
        endpoint="https://yourapi.com/api/v1/feedbacks"
        metaEndpoint="https://yourapi.com/api/v1/feedbacks/meta"
        adminEmails={["admin@yourcompany.com"]}
        currentUserEmail={currentUser?.email}
      />
    </>
  );
}
```

## CSS Customization
```css
:root {
  --fb-primary: #7c3aed;       /* change brand colour */
  --fb-radius: 0.75rem;        /* rounder corners */
  --fb-font: "Inter", sans-serif;
}
```

## Backend API Contract

Your backend must implement these endpoints:

### POST /api/v1/feedbacks
Accepts: `{ email, clinical_site, feedback_type, feedback_status, page, initial_message }`
Returns: `{ success: true, id: number }`

### GET /api/v1/feedbacks/meta
Returns: `{ types: [...], organisations: [...], statuses: [...] }`
Each item: `{ id: number, name: string, label?: string }`

### GET /api/v1/admin/feedbacks
Returns: `{ data: FeedbackData[] }`

### PATCH /api/v1/admin/feedbacks/:id
Accepts: `{ action: "status"|"close"|"wontfix"|"promote"|"delete"|"restore", value?: number }`
Returns: `{ success: boolean, error?: string }`

### POST /api/v1/admin/keys
Header: `x-bootstrap-token: <FEEDBACK_BOOTSTRAP_TOKEN>`
Accepts: `{ projectSlug?, projectName?, keyName?, isAdmin? }`
Returns: `{ success: true, data: { apiKey, projectId, projectSlug, isAdmin, ... } }`

### GET /api/v1/docs
Swagger UI docs for all v1 endpoints.

## Security
The widget does not handle authentication itself. Use these props to pass credentials:
- `token` — sends as `Authorization: Bearer <token>`
- `apiKey` — sends as `x-api-key: <key>`
Your backend validates these on each request.
