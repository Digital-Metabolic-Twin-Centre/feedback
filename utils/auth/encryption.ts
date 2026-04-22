import Cryptr from "cryptr";
import { env } from "@/lib/env-validation";

// Encrypt function with TypeScript types
export function encrypt(text: string): string {
  const secretKey = env.NEXTAUTH_SECRET;
  
  // Ensure the secretKey exists and is a valid string
  if (!secretKey) {
    throw new Error("NEXTAUTH_SECRET environment variable is not set.");
  }

  const cryptr = new Cryptr(secretKey);
  const encryptedString = cryptr.encrypt(text);
  
  return encryptedString;
}

// Decrypt function with TypeScript types
export function decrypt(encryptedString: string): string {
  const secretKey = env.NEXTAUTH_SECRET;
  
  // Ensure the secretKey exists and is a valid string
  if (!secretKey) {
    throw new Error("NEXTAUTH_SECRET environment variable is not set.");
  }

  const cryptr = new Cryptr(secretKey);
  const text = cryptr.decrypt(encryptedString);

  return text;
}
