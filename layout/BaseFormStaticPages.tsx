"use client";

import { Footer } from "@/components/hub/Footer";
import TopMenu from "@/components/top-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NO_AUTH_BUTTONS, SITE_PATHS } from "@/lib/urls";
import { usePathname } from "next/navigation";

interface StaticPageLayoutProps {
  title: string;
  subTitle?: string;
  children: React.ReactNode;
}

export default function BaseFormStaticPages({
  title,
  subTitle = "",
  children,
}: StaticPageLayoutProps) {
  const pathname = usePathname();
  const hideAuthButtons = NO_AUTH_BUTTONS.some((route: string) =>
    pathname.startsWith(route),
  );

  return (
    <main className="app-shell">
      <TopMenu title={title} subTitle={subTitle} hideAuthButtons={hideAuthButtons} />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 md:px-6">
        <section className="page-section p-4 md:p-6">
          <Breadcrumb>
            <BreadcrumbList className="pb-4 text-sm text-slate-500">
              <BreadcrumbItem>
                <BreadcrumbLink href={SITE_PATHS.HOMEPAGE}>Workspace</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {children}
        </section>
        <Footer />
      </div>
    </main>
  );
}
