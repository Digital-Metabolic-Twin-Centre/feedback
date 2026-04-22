"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/utils/auth/auth-options";
import { Session } from "next-auth"; // Import Session type

/**
 * Fetch the user session from the server.
 * @returns The user session or null if not authenticated.
 */

// Private function to get the user session
async function fetchUserSession(): Promise<Session | null> {
  try {
    return await getServerSession(authOptions);
  } catch (error) {
    console.error("Error fetching user session:", error);
    return null;
  }
}

// Get user email from session
export async function getUserEmailFromSession(): Promise<string[]> {
  const session = await fetchUserSession();
  return session?.user?.email ? [session.user.email] : [];
}

// Get user name from session
export async function getUserNameFromSession(): Promise<string[]> {
  const session = await fetchUserSession();
  return session?.user?.name ? [session.user.name] : [];
}

// Check if user has a valid session
export async function hasValidSession(): Promise<boolean> {
  const session = await fetchUserSession();

  // `getServerSession` already returns null if expired/invalid,
  // just an extra check for `expires`
  if (!session) return false;

  if (session.expires && new Date(session.expires) < new Date()) {
    return false; // expired
  }

  return true; // session is valid
}