// app/layout.tsx
import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import ToastTrigger from "@/components/hub/ToastTrigger";
import "./globals.css";
import { ClientProviders } from "@/hooks/client-provider";
import { FormStateProvider } from "@/hooks/form-state-provider";
import { headers } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { GlobalFeedbackButton } from "@/components/hub/global-feedback-button";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Feedback Workspace",
  description: "A reusable feedback and discussion platform.",
};

export default async function RootLayout({
  children,
}: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang="en">
      <head></head>
      <body
        className={`${manrope.variable} ${fraunces.variable} min-h-screen w-full bg-background font-sans text-foreground antialiased`}
      >
        <FormStateProvider>
          <ClientProviders session={null}>
            {children}
            <GlobalFeedbackButton />
          </ClientProviders>
        </FormStateProvider>
        <Toaster richColors />
        <Suspense fallback={null}>
          <ToastTrigger />
        </Suspense>
        {nonce && <Script id="nonce-provider" nonce={nonce} />}
      </body>
    </html>
  );
}
