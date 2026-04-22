import React from "react";
import Link from "next/link";

interface ButtonProps {
  buttonLabel?: string; // Optional button label
  buttonLink?: string; // Optional button link
  additionalClass?: string; // extra classes specific to individual buttons
  onClick?: () => void;
}

export default function Button({
  buttonLabel = "Default label text goes here",
  buttonLink = "/",
  additionalClass = "",
  onClick,
}: ButtonProps) {
  return buttonLink ? (
    <Link
      href={buttonLink}
      className={`block w-full py-2 bg-[#5b76ac] hover:underline text-white text-center rounded-[32px] text-md font-bold ${additionalClass}`}
    >
      {buttonLabel}
    </Link>
  ) : (
    <button
      onClick={onClick}
      className={`block w-full py-2 bg-[#5b76ac] hover:underline text-white text-center rounded-[32px] text-md font-bold ${additionalClass}`}
    >
      {buttonLabel}
    </button>
  );
}
