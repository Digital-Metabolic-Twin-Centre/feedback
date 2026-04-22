"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { SITE_PATHS } from "@/lib/urls";
import { useClientSession } from "@/utils/auth/get-user-client-session";
import SignInButton from "@/layout/SignInButton";
import SignOutButton from "@/layout/SignOutButton";

type TopMenuProps = {
  title: string;
  subTitle?: string;
  hideAuthButtons: boolean;
};

export default function TopMenu({
  title,
  subTitle = "",
  hideAuthButtons,
}: TopMenuProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hasValidSession, getUserEmail } = useClientSession();
  const isValid = hasValidSession();
  const userEmail = getUserEmail();

  const links = [
    { label: "Home", href: SITE_PATHS.HOMEPAGE },
    { label: "Feedbacks", href: SITE_PATHS.FEEDBACKS },
    { label: "Admin", href: SITE_PATHS.ADMIN },
  ];

  return (
    <header className="border-b bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900 md:text-xl">
              {title}
            </h1>
            {subTitle ? (
              <p className="truncate text-sm text-slate-600">{subTitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border p-2 text-slate-700 md:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <nav className="hidden items-center gap-2 md:flex">
            {links.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {mobileOpen ? (
          <nav className="mt-3 grid gap-1 border-t pt-3 md:hidden">
            {links.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {!hideAuthButtons ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-sm text-slate-600">
            <span>
              {isValid && userEmail ? `Signed in as ${userEmail}` : "Public access"}
            </span>
            {isValid && userEmail ? <SignOutButton /> : <SignInButton />}
          </div>
        ) : null}
      </div>
    </header>
  );
}
