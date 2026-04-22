"use client";

import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MenuItem } from "@/lib/menus";

interface NavMixedProps {
  items: MenuItem[];
  openMenu: string | null;
  setOpenMenu: React.Dispatch<React.SetStateAction<string | null>>;
  pathname: string;
}

export function NavMixed({
  items,
  openMenu,
  setOpenMenu,
  pathname,
}: NavMixedProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Compute initial open sub-menu from pathname so it's correct on first render (e.g. page reload)
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(() => {
    for (const item of items) {
      if (item.items) {
        for (const sub of item.items) {
          if (
            sub.items?.some((subsub) => pathname.startsWith(subsub.url)) ||
            (sub.items &&
              sub.items.length > 0 &&
              pathname.startsWith(sub.url) &&
              !sub.url.startsWith("#"))
          ) {
            return sub.url;
          }
        }
      }
    }
    return null;
  });

  // Keep sub-menu in sync when pathname changes after initial render
  useEffect(() => {
    for (const item of items) {
      if (item.items) {
        for (const sub of item.items) {
          if (
            sub.items?.some((subsub) => pathname.startsWith(subsub.url)) ||
            (sub.items &&
              sub.items.length > 0 &&
              pathname.startsWith(sub.url) &&
              !sub.url.startsWith("#"))
          ) {
            setOpenSubMenu(sub.url);
            return;
          }
        }
      }
    }
  }, [pathname, items]);

  const handleToggle = (title: string) => {
    setOpenMenu((prev) => (prev === title ? null : title));
  };

  const handleSubToggle = (url: string) => {
    setOpenSubMenu((prev) => (prev === url ? null : url));
  };

  return (
    <SidebarGroup className="-mb-5">
      <SidebarMenu>
        {items.map((item) => {
          const title = item.title || "";
          const key = item.url;
          const isOpen = openMenu === title;
          const isActive =
            pathname === item.url ||
            item.items?.some(
              (sub) =>
                pathname.startsWith(sub.url) ||
                sub.items?.some((subsub) => pathname.startsWith(subsub.url)),
            );

          return item.items && item.items.length > 0 ? (
            <Collapsible
              key={key}
              asChild
              open={isOpen}
              onOpenChange={() => handleToggle(title)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                {isCollapsed ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton
                        tooltip={title}
                        className={cn(
                          "transition-colors",
                          isActive
                            ? "bg-blue-700 text-white"
                            : "hover:bg-blue-800 text-gray-200",
                        )}
                      >
                        {item.icon && <item.icon className="h-5 w-5" />}
                        <span>{title}</span>
                      </SidebarMenuButton>
                    </PopoverTrigger>
                    <PopoverContent
                      side="right"
                      align="start"
                      className="w-60 p-2 bg-blue-800 border-blue-700"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="px-2 py-1 text-sm font-semibold text-white">
                          {title}
                        </div>
                        {item.items.map((sub) => {
                          const isSubActive = pathname.startsWith(sub.url);
                          if (sub.items && sub.items.length > 0) {
                            return (
                              <div key={sub.url}>
                                <div className="px-2 py-1 text-xs font-semibold text-blue-300 uppercase tracking-wide">
                                  {sub.title}
                                </div>
                                {sub.items.map((subsub) => {
                                  const isSubSubActive = pathname.startsWith(
                                    subsub.url,
                                  );
                                  return (
                                    <a
                                      key={subsub.url}
                                      href={subsub.url}
                                      className={cn(
                                        "pl-4 pr-2 py-1.5 text-sm rounded-md transition-colors flex overflow-hidden",
                                        isSubSubActive
                                          ? "bg-blue-700 text-white"
                                          : "text-gray-200 hover:bg-blue-700 hover:text-white",
                                      )}
                                    >
                                      <span className="truncate">{subsub.title}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            );
                          }
                          return (
                            <a
                              key={sub.url}
                              href={sub.url}
                              className={cn(
                                "px-2 py-1.5 text-sm rounded-md transition-colors truncate",
                                isSubActive
                                  ? "bg-blue-700 text-white"
                                  : "text-gray-200 hover:bg-blue-700 hover:text-white",
                              )}
                            >
                              {sub.title}
                            </a>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={title}
                        className={cn(
                          "transition-colors",
                          isActive
                            ? "bg-blue-700 text-white"
                            : isOpen
                              ? "bg-blue-700 text-white"
                              : "hover:bg-blue-800 text-gray-200",
                        )}
                      >
                        {item.icon && <item.icon className="h-5 w-5" />}
                        <span>{title}</span>
                        <ChevronRight
                          className={cn(
                            "ml-auto transition-transform duration-300",
                            isOpen && "rotate-90",
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent
                      className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        isOpen
                          ? "max-h-[500px] opacity-100"
                          : "max-h-0 opacity-0",
                      )}
                    >
                      <SidebarMenuSub className="pt-1">
                        {item.items.map((sub) => {
                          const isSubActive =
                            pathname.startsWith(sub.url) ||
                            sub.items?.some((subsub) =>
                              pathname.startsWith(subsub.url),
                            );

                          if (sub.items && sub.items.length > 0) {
                            const isSubOpen = openSubMenu === sub.url;
                            const hasRealUrl =
                              sub.url && !sub.url.startsWith("#");
                            return (
                              <SidebarMenuSubItem key={sub.url}>
                                <Collapsible
                                  open={isSubOpen}
                                  onOpenChange={() => handleSubToggle(sub.url)}
                                >
                                  <div className="flex items-center w-full min-w-0">
                                    {hasRealUrl ? (
                                      <SidebarMenuSubButton
                                        asChild
                                        className={cn(
                                          "flex-1 min-w-0 transition-colors",
                                          isSubActive
                                            ? "bg-blue-700 text-white"
                                            : isSubOpen
                                              ? "bg-blue-700/60 text-white"
                                              : "hover:bg-blue-800 text-gray-200",
                                        )}
                                      >
                                        <a
                                          href={sub.url}
                                          onClick={() => {
                                            if (!isSubOpen)
                                              handleSubToggle(sub.url);
                                          }}
                                        >
                                          <span>{sub.title}</span>
                                        </a>
                                      </SidebarMenuSubButton>
                                    ) : (
                                      <SidebarMenuSubButton
                                        className={cn(
                                          "flex-1 min-w-0 transition-colors",
                                          isSubActive
                                            ? "bg-blue-700 text-white"
                                            : isSubOpen
                                              ? "bg-blue-700/60 text-white"
                                              : "hover:bg-blue-800 text-gray-200",
                                        )}
                                        onClick={() => handleSubToggle(sub.url)}
                                      >
                                        <span>{sub.title}</span>
                                      </SidebarMenuSubButton>
                                    )}
                                    <CollapsibleTrigger asChild>
                                      <button
                                        className={cn(
                                          "px-1.5 py-1 rounded transition-colors",
                                          isSubActive || isSubOpen
                                            ? "text-white hover:bg-blue-600"
                                            : "text-gray-200 hover:bg-blue-800",
                                        )}
                                      >
                                        <ChevronRight
                                          className={cn(
                                            "h-3.5 w-3.5 transition-transform duration-300",
                                            isSubOpen && "rotate-90",
                                          )}
                                        />
                                      </button>
                                    </CollapsibleTrigger>
                                  </div>
                                  <CollapsibleContent
                                    className={cn(
                                      "overflow-hidden transition-all duration-300 ease-in-out",
                                      isSubOpen
                                        ? "max-h-96 opacity-100"
                                        : "max-h-0 opacity-0",
                                    )}
                                  >
                                    <SidebarMenuSub>
                                      {sub.items.map((subsub) => {
                                        const isSubSubActive =
                                          pathname.startsWith(subsub.url);
                                        return (
                                          <SidebarMenuSubItem key={subsub.url}>
                                            <SidebarMenuSubButton
                                              asChild
                                              className={cn(
                                                "transition-colors",
                                                isSubSubActive
                                                  ? "bg-blue-700 text-white"
                                                  : "hover:bg-blue-800 text-gray-200",
                                              )}
                                            >
                                              <a href={subsub.url}>
                                                <span>{subsub.title}</span>
                                              </a>
                                            </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                        );
                                      })}
                                    </SidebarMenuSub>
                                  </CollapsibleContent>
                                </Collapsible>
                              </SidebarMenuSubItem>
                            );
                          }

                          return (
                            <SidebarMenuSubItem key={sub.url}>
                              <SidebarMenuSubButton
                                asChild
                                className={cn(
                                  "transition-colors",
                                  isSubActive
                                    ? "bg-blue-700 text-white"
                                    : "hover:bg-blue-800 text-gray-200",
                                )}
                              >
                                <a href={sub.url}>
                                  <span>{sub.title}</span>
                                </a>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                )}
              </SidebarMenuItem>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={key}>
              <SidebarMenuButton
                asChild
                tooltip={title}
                className={cn(
                  "transition-colors",
                  pathname === item.url
                    ? "bg-blue-700 text-white"
                    : "hover:bg-blue-800 text-gray-200",
                )}
              >
                <a href={item.url}>
                  {item.icon && <item.icon className="h-5 w-5" />}
                  <span>{title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
