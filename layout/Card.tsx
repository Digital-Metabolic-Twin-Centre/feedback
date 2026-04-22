"use client";

import React, { ReactNode, useState } from "react";
import SignInButton from "./SignInButton";
import { useSession } from "next-auth/react";

interface CardProps {
  cardTitle?: string;
  cardText?: string;
  buttonLabel?: string;
  buttonLink?: string;
  children?: ReactNode;
}

export default function Card({
  cardTitle = "Default Title",
  cardText = "Default text content goes here.",
  buttonLabel = "Default label text goes here",
  buttonLink = "/",
  children,
}: CardProps) {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";
  const [showPopup, setShowPopup] = useState(false);

  const handleButtonClick = () => {
    const label = buttonLabel.toLowerCase();

    //  Show popup only for these actions when NOT logged in
    if (
      !isLoggedIn &&
      (label.includes("participant registration") ||
        label.includes("view documents"))
    ) {
      setShowPopup(true);
      return;
    }

    //  Otherwise, normal behavior navigate to link
    window.location.href = buttonLink;
  };

  return (
    <div className="bg-white border my-2 md:my-4 lg:my-8 rounded-3xl shadow-md px-2 py-5 flex flex-col justify-end text-center h-60 relative">
      <div className="flex-grow">
        <div className="flex justify-center items-center mb-4 text-blue-800">
          {children}
        </div>
        <h1 className="text-lg font-semibold">{cardTitle}</h1>
        <p className="text-[#8f8272] text-xs sm:text-sm xl:text-base font-medium">
          {cardText}
        </p>
      </div>

      <div className="mt-auto">
        <button
          onClick={handleButtonClick}
          className="bg-blue-900 text-white hover:bg-blue-800 text-xs font-bold rounded-lg px-4 py-2 transition-all"
        >
          {buttonLabel}
        </button>
      </div>

      {/*  Popup */}
      {showPopup && (
        <div className="absolute inset-0 bg-black/40 flex justify-center items-center rounded-3xl">
          <div className="bg-white p-3 rounded-2xl shadow-lg text-center w-4/5 max-w-sm">
            <h2 className="text-sm font-bold text-red-900 mb-2">
              Sign in required
            </h2>
            <p className="text-gray-600 mb-4 text-sm">
              You need to sign in to access this section of the workspace.
            </p>
            <div className="flex justify-center !text-sm">
              <SignInButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
