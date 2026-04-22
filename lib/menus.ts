import { MessageSquare, Info, LucideIcon } from "lucide-react";
import { SITE_PATHS } from "./urls";

export interface SubMenuItem {
  title?: string;
  url: string;
  roles?: string[];
  items?: {
    title?: string;
    url: string;
    roles?: string[];
  }[];
}

export interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  iconColor?: string;
  isActive?: boolean;
  roles?: string[];
  items?: SubMenuItem[];

  // Optional fields for resources menu
  description?: string | null;
  card?: string | null;
  iconBg?: string | null;
}

export interface MenuData {
  footerMenu: MenuItem[];
}

export const menuData: MenuData = {
  footerMenu: [
    {
      title: "Feedbacks",
      url: SITE_PATHS.FEEDBACKS,
      icon: MessageSquare,
      iconColor: "text-white",
    },
    {
      title: "About",
      url: SITE_PATHS.ABOUT,
      icon: Info,
      iconColor: "text-white",
    },
  ],
};
