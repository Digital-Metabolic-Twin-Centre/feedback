"use client";
import { useState } from "react";

export type LoadingStatus = "idle" | "loading" | "success" | "error";

export function useFormState() {
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  return { loadingStatus, setLoadingStatus, errorMessage, setErrorMessage };
}
