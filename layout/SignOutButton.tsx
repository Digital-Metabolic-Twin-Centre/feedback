"use client";

// import { signOut } from "next-auth/react";
import { API_ENDPOINTS } from "@/lib/urls";

export default function SignOutButton() {
  return (
    <button
      onClick={async () => {
        // Kill NextAuth session first
        // await signOut({ redirect: false });

        // Session and keycloak logout is handled in the backend to ensure cookies are cleared properly
        window.location.href = API_ENDPOINTS.LOGOUT;
      }}
      className="border border-solid rounded-md  transition
       duration-150 ease-in-out text-white bg-blue-950 hover:bg-blue-800 align-text-top px-3 py-1 cursor-pointer"
    >
      Sign out
    </button>
  );
}
 