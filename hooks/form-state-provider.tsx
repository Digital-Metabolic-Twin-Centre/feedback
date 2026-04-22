"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useFormState } from "@/hooks/use-custom-form-state";

// Create a context with an undefined initial value.
const FormStateContext = createContext<ReturnType<typeof useFormState> | undefined>(undefined);

export const FormStateProvider = ({ children }: { children: ReactNode }) => {
  // Get the form state from your custom hook.
  const formState = useFormState();

  return (
    <FormStateContext.Provider value={formState}>
      {children}
    </FormStateContext.Provider>
  );
};

// A custom hook to easily access the shared form state.
export const useSharedFormState = () => {
  const context = useContext(FormStateContext);
  if (!context) {
    throw new Error("useSharedFormState must be used within a FormStateProvider");
  }
  return context;
};
