"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
        Something went wrong
      </p>
      <h1 className="mt-3 text-xl font-semibold text-navy">Could not render this page</h1>
      <p className="mt-3 text-sm text-muted">
        {error.message || "An unexpected client error occurred."}
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[11px] text-muted">Digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white"
      >
        Try again
      </button>
      <a href="/" className="mt-3 text-sm font-medium text-teal hover:underline">
        Back to home
      </a>
    </div>
  );
}
