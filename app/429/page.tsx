import Link from "next/link";
import { SITE_PATHS } from "@/lib/urls";

/**
 * 
 * @returns A user-friendly 429 Too Many Requests error page
 */

export default function TooManyRequestsPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6">
      <div className="max-w-md text-center">
        <h1 className="text-5xl font-extrabold text-red-600">429</h1>
        <h2 className="mt-2 text-2xl font-semibold text-gray-800">
          Too Many Requests
        </h2>
        <p className="mt-4 text-gray-600 leading-relaxed">
          You have made too many requests in a short period of time.
          Please wait for sometime before trying again.
        </p>

        <div className="mt-6">
          <Link
            href={SITE_PATHS.HOMEPAGE}
            className="inline-block rounded-lg bg-red-600 px-6 py-2 text-white font-medium shadow hover:bg-red-500 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
