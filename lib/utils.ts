// Utility function to conditionally merge class names while resolving Tailwind conflicts.
// - `clsx` removes falsy values and conditionally applies classes.
// - `twMerge` ensures that conflicting Tailwind classes are merged correctly.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
