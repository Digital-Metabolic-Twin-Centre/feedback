export const ADVERSE_EVENT_NOTIFICATION = {
    subject: "New Adverse Event Reported",
    text: `A new adverse event has been reported. Please review it in the workspace.`,
    html: `
    <p>A new adverse event has been reported.</p>
    <p>Please review it in the workspace.</p>
  `,
    sessionId: "Adverse event creation",
    userEmail: null,
};




export function unassignedUserNotification(shortSessionId: string) {
    const time = new Date().toISOString();

    return {
        subject: "Workspace: User signed in without group assignment",

        text: `
A user has signed in without any group assignment.

Session ID: ${shortSessionId}
Time: ${time}

Action required:
Please review and assign the appropriate group in Keycloak.
`,

        html: `
<p>A user has signed in without any group assignment</p>
<ul>
<li><strong>Session ID:</strong> ${shortSessionId}</li>
<li><strong>Time:</strong> ${time}</li>
</ul>
<p>
<strong>Action required:</strong><br/>
Please review and assign the appropriate group in Keycloak.
</p>
`,
    };
}
