"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SITE_PATHS } from "@/lib/urls";
import { NavProjects } from "@/components/nav-projects";
import { menuData } from "@/lib/menus";
import { Home } from "lucide-react";

type AppSidebarProps = React.ComponentProps<typeof Sidebar>;

export function AppSidebar({ ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-3 px-3 py-4">
        <div className="flex items-center gap-3 px-2 py-1">
          <Link
            href={SITE_PATHS.HOMEPAGE}
            className="flex items-center gap-3 transition hover:opacity-90"
          >
            <Image
              src="/images/imdhub_logo.png"
              width={90}
              height={36}
              style={{ height: "auto" }}
              alt="Workspace logo"
              loading="eager"
              className="rounded-md"
            />
            <div className="group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-semibold text-sidebar-foreground">
                Feedback Tool
              </p>
              <p className="text-xs text-sidebar-foreground/70">
                Shared workspace
              </p>
            </div>
          </Link>
        </div>

        <SidebarMenuItem className="mt-1">
          <SidebarMenuButton asChild>
            <Link href={SITE_PATHS.HOMEPAGE} className="rounded-md transition">
              <Home />
              <span>Home</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarHeader>

      <SidebarContent />

      <SidebarFooter className="gap-3 px-3 pb-4 pt-2">
        <NavProjects projects={menuData.footerMenu} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
