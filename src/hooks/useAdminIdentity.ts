"use client";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "feedback_identity_email";

export function useAdminIdentity(adminEmails: string[] = []) {
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    setEmail(saved);
    setIsAdmin(adminEmails.map(e => e.toLowerCase()).includes(saved.trim().toLowerCase()));
    setMounted(true);
  }, []); // eslint-disable-line

  const identify = useCallback((newEmail: string) => {
    const trimmed = newEmail.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setEmail(trimmed);
    setIsAdmin(adminEmails.map(e => e.toLowerCase()).includes(trimmed.toLowerCase()));
  }, [adminEmails]);

  const clearIdentity = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setEmail("");
    setIsAdmin(false);
  }, []);

  return { email, isAdmin, identify, clearIdentity, mounted };
}
