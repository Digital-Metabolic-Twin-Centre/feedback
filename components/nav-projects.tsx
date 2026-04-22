"use client";

import { type LucideIcon } from "lucide-react";
// // import { toast } from "sonner";
// import { useClientSession } from "@/utils/auth/get-user-client-session";
// // import { SITE_PATHS } from "@/lib/urls";
// // import { SITE_PERMISSIONS } from "@/lib/permissions";
// import { useSession } from "next-auth/react";

import {
  SidebarGroup,
  SidebarMenu,
  // SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavProjects({
  projects,
}: {
  projects: {
    title: string;
    url: string;
    icon: LucideIcon;
    iconColor?: string;
  }[];
}) {

  return (
    <SidebarGroup className="-mb-4">
      {/* <SidebarGroupLabel className="text-white">Menu</SidebarGroupLabel> */}
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              {/* onClick={(e) => handleClick(e, item.url)} */}
              <a href={item.url}>
                <item.icon className={item.iconColor || "text-white"} />
                <span>{item.title}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
