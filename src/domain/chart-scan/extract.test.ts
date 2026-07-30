import { describe, expect, it } from "vitest";
import { extractTextFromUpload } from "./extract";

describe("extractTextFromUpload", () => {
  it("reads plain text", async () => {
    const r = await extractTextFromUpload({
      fileName: "note.txt",
      mimeType: "text/plain",
      data: Buffer.from("OASIS SOC documentation with enough content for analysis here."),
    });
    expect(r.method).toBe("utf8");
    expect(r.text).toContain("OASIS");
  });

  it("flags empty unknown binary", async () => {
    const r = await extractTextFromUpload({
      fileName: "x.bin",
      mimeType: "application/octet-stream",
      data: Buffer.from([0, 1, 2, 3, 4]),
    });
    expect(r.method).toBe("empty");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
