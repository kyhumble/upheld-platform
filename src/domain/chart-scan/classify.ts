import type { DocumentType } from "./types";

export function classifyDocumentText(fileName: string, text: string): DocumentType {
  const blob = `${fileName}\n${text}`.toLowerCase();

  if (/oasis|m00\d{2}|m1\d{3}|gg01|start of care|resumption of care/.test(blob)) {
    return "OASIS";
  }
  if (/face[- ]?to[- ]?face|f2f|encounter with the patient/.test(blob)) {
    return "F2F";
  }
  if (/pressure ulcer|wound|stage\s*[1-4]|debrid|dressing change|tunneling/.test(blob)) {
    return "WOUND";
  }
  if (/plan of care|physician order|orders dated|frequency.*week|signed by/.test(blob)) {
    return "ORDERS";
  }
  if (/certification|recertification|cert period|485/.test(blob)) {
    return "CERTIFICATION";
  }
  if (/visit note|skilled nursing|sn visit|pt visit|progress note|vitals/.test(blob)) {
    return "VISIT_NOTE";
  }
  if (text.trim().length > 80) return "OTHER";
  return "UNKNOWN";
}

export function extractPatientLabel(text: string): string | null {
  const patterns = [
    /Patient:\s*["']?([^\n"']{3,60})/i,
    /Patient Name:\s*([^\n]{3,60})/i,
    /Name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim().slice(0, 80);
  }
  return null;
}

export function extractPeriodHint(text: string): string | null {
  const cert = text.match(
    /Certification Period:\s*([0-9/\-–—\s]{8,40})/i,
  );
  if (cert?.[1]) return cert[1].trim();
  const soc = text.match(/SOC Date:\s*([0-9/\-]{8,12})/i);
  if (soc?.[1]) return `SOC ${soc[1].trim()}`;
  return null;
}

/** Best-effort clinician / assessing clinician label from chart text (not identity proof). */
export function extractClinicianHint(text: string): string | null {
  const patterns = [
    /Assessing clinician:\s*([^\n]{3,80})/i,
    /Clinician:\s*([^\n]{3,80})/i,
    /Primary nurse:\s*([^\n]{3,80})/i,
    /RN(?:\s+assessor)?:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/,
    /signed by RN\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)/i,
    /comprehensive assessment signed by RN\s+([^\n,]{3,60})/i,
    /SN notes?.*?\b([A-Z][a-z]+\s+[A-Z][a-z]+),?\s*RN\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const cleaned = m[1].replace(/\s+/g, " ").trim().slice(0, 80);
      if (cleaned.length >= 3 && !/not present|unknown|n\/a/i.test(cleaned)) {
        return cleaned;
      }
    }
  }
  return null;
}
