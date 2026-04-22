"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TiArrowSortedDown } from "react-icons/ti";
import {  SITE_PATHS } from "@/lib/urls";

interface BreadCrumbProbs {
  crumb?: string; // Optional page title for breadcrumb
  onHover?: () => void;
}

const Breadcrumb = ({ crumb }: BreadCrumbProbs) => {
  const pathname = usePathname();
  const isHomePage = pathname === SITE_PATHS.HOMEPAGE;


  return (
    <nav className="bg-[#e8ecef] px-4 py-2">
      <ul className="flex items-center text-md">
        <li className="flex items-center ">
          <span className="text-[#017ffd] hover:underline hover:decoration-1 hover:cursor-pointer">
            apps
          </span>
          <TiArrowSortedDown className="ml-1 text-[#017ffd]" />
          <span className="mx-2 text-gray-400 opacity-3">/</span>
        </li>
        <li
          className={` ${isHomePage ? "text-gray-400 opacity-3" : "text-[#017ffd]"
            }`}
        >
          <span className="hover:underline hover:decoration-1 hover:cursor-pointer">
            <Link href="/">Workspace</Link>
          </span>

          <span
            className={` text-gray-400 opacity-2 ${isHomePage ? "hidden" : ""}`}
          >
            <span className={`mx-2 `}>/</span>
            {crumb ? crumb : ""}
          </span>
        </li>
      </ul>
    </nav>
  );
};

export default Breadcrumb;
