'use client';

import { useEffect } from "react";
import { useSession, getSession, signOut } from "next-auth/react";

/**
 * Custom hook to manage client-side user session.
 * @returns An object containing session information and utility functions.
 */

// Client-side hook for session management
export function useClientSession() {
  const { data: session, status } = useSession();

  // Revalidate every minute
  useEffect(() => {
    const interval = setInterval(() => {
      getSession();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Auto logout if expired
  //! prevent signout button still showing
  useEffect(() => {
    const isExpired = session?.expires && new Date(session.expires) < new Date();
    const hasError = session?.error === 'SessionExpired' || session?.error === 'TokenExpired';
    
    if (isExpired || hasError) {
      const currentPath = window.location.pathname + window.location.search;
      signOut({ callbackUrl: currentPath });
    }
  }, [session]);

  const getUserEmail = (): string => {
    return session?.user?.email || "";
  };

  const getUserName = (): string => {
    return session?.user?.name || "";
  };

  const hasValidSession = (): boolean => {
    if (status === 'loading') return false;
    if (!session) return false;

    // Check if session is expired
    if (session.expires && new Date(session.expires) < new Date()) {
      return false;
    }

    return status === 'authenticated';
  };

  const getUserGroups = (): string[] => {
    return session?.groups ?? [];
  };

  const isLoading = status === 'loading';

  return {
    session,
    status,
    getUserEmail,
    getUserName,
    getUserGroups,
    hasValidSession,
    isLoading,
  };
}