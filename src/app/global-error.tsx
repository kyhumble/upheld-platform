"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f7f8fa",
          color: "#142033",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: "20vh auto",
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20, color: "#052355" }}>Upheld failed to load</h1>
          <p style={{ fontSize: 14, color: "#5a6a7a", lineHeight: 1.5 }}>
            {error.message || "A client-side exception occurred."}
          </p>
          {error.digest ? (
            <p style={{ fontSize: 11, fontFamily: "monospace", color: "#5a6a7a" }}>
              {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "10px 16px",
              background: "#052355",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
