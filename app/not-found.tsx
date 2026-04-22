import Link from "next/link";
import { SITE_PATHS } from "@/lib/urls";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
        <p className="text-gray-600 max-w-md">
          Sorry, the page you are looking for does not exist or has been
          moved.
        </p>

        <Link href={SITE_PATHS.HOMEPAGE} className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
