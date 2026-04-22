"use client";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center text-center gap-4">
          <h2 className="text-2xl font-bold text-red-700">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-600">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => reset()}
            className="mt-4 w-full rounded-lg bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
