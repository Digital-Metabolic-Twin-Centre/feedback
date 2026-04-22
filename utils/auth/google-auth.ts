import { google } from "googleapis";
import { env } from "@/lib/env-validation";

export const jwtClient = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
