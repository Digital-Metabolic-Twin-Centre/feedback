"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { SITE_PATHS } from "@/lib/urls";
import { useAdminIdentity } from "@/hooks/use-admin-identity";

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
  const [emailInput, setEmailInput] = useState("");
  const [identityOpen, setIdentityOpen] = useState(false);
  const { email, isAdmin, identify, clearIdentity, mounted } = useAdminIdentity();

  const links = [
    { label: "Home", href: SITE_PATHS.HOMEPAGE },
    { label: "Feedbacks", href: SITE_PATHS.FEEDBACKS },
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

        {!hideAuthButtons && mounted ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-sm text-slate-600">
            {email ? (
              <>
                <span>
                  {email}
                  {isAdmin && (
                    <span className="ml-2 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700">
                      Admin
                    </span>
                  )}
                </span>
                <button
                  onClick={clearIdentity}
                  className="text-xs text-slate-400 underline hover:text-slate-700"
                >
                  Clear
                </button>
              </>
            ) : identityOpen ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (emailInput) {
                    identify(emailInput);
                    setEmailInput("");
                    setIdentityOpen(false);
                  }
                }}
              >
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="your@email.com"
                  className="rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                  autoFocus
                />
                <button
                  type="submit"
                  className="text-sm text-cyan-700 hover:underline"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => setIdentityOpen(false)}
                  className="text-xs text-slate-400 hover:underline"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIdentityOpen(true)}
                className="text-xs text-slate-500 underline hover:text-slate-700"
              >
                Identify yourself
              </button>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
