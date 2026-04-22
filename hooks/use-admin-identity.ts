"use client";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "feedback_identity_email";

function getAdminEmailsList(): string[] {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function useAdminIdentity() {
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    setEmail(saved);
    setIsAdmin(getAdminEmailsList().includes(saved.trim().toLowerCase()));
    setMounted(true);
  }, []);

  const identify = useCallback((newEmail: string) => {
    const trimmed = newEmail.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setEmail(trimmed);
    setIsAdmin(getAdminEmailsList().includes(trimmed.toLowerCase()));
  }, []);

  const clearIdentity = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setEmail("");
    setIsAdmin(false);
  }, []);

  return { email, isAdmin, identify, clearIdentity, mounted };
}
