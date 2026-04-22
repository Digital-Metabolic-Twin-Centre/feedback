// next-auth augmentation

// types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    access_token: string;
    id_token: string;
    sessionId?: string;
    roles?: string[];
    groups?: string[];
    error?: string;
    user?: {
      id?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      groups?: string[];

    } & DefaultSession["user"]
  }
}