"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
import { decrypt } from "./encryption";
import jwt from "jsonwebtoken";

// Function to get and decrypt the access token
export async function getAccessToken(): Promise<string | null> {
  const session = await getServerSession(authOptions);  

  // Ensure the session exists and has an access token
  if (session?.access_token) {
    const accessTokenDecrypted = decrypt(session.access_token);
    return accessTokenDecrypted;
  }

  return null;
}

// Function to get and decrypt the ID token
export async function getIdToken(): Promise<string | null> {
  const session = await getServerSession(authOptions);  

  // Ensure the session exists and has an ID token
  if (session?.id_token) {
    const idTokenDecrypted = decrypt(session.id_token);
    return idTokenDecrypted;
  }

  return null;
}


// Function to extract user ID from the access token
export async function getUserIdFromAccessToken(): Promise<string | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const decoded = jwt.decode(accessToken) as { sub?: string } | null;

  if (!decoded?.sub) {
    return null;
  }

  return decoded.sub; 
}