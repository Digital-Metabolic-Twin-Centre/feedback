"use client";

/**
 * Unauthorized access page
 * Displays a 403 Forbidden message when a user tries to access a restricted page.
 */

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import {  SITE_PATHS } from "@/lib/urls";

export default function Page() {
  const searchParams = useSearchParams();
  const reason = searchParams?.get("reason");

  const getMessage = () => {
    switch (reason) {
      case "no-groups":
        return "You are not assigned to any clinical sites.";
      case "no-permissions":
        return "You don't have the required roles or clinical site access.";
      case "select":
        return "Select API call not permitted using this channel";
      case "update":
        return "Update API call not permitted using this channel";
      case "delete":
        return "Delete API call not permitted using this channel";
      case "create":
        return "Create API call not permitted using this channel";
      case "identifier":
        return "Identifier API call not permitted using this channel";
      case "maintenance-access":
        return "You don't have permission to access the site in maintenance mode.";
      default:
        return "You don't have permission to access or carry out the following action on this page.";
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <AlertTriangle className="h-16 w-16 text-red-500" />
        <h1 className="text-4xl font-bold">403 Forbidden</h1>
        <p className="text-gray-600 max-w-md">
          {getMessage()} Contact an administrator for assistance.
        </p>
        <Button asChild className="mt-4">
          <Link href={SITE_PATHS.HOMEPAGE}>Back to homepage</Link>
        </Button>
      </div>
    </main>
  );
}
