/**
 * Synthetic de-identified home health episodes for demo / free scan without upload.
 * Not real PHI.
 */

export const SAMPLE_CHART_FILENAME = "sample-episode-at-risk.txt";
export const SAMPLE_CLEAN_FILENAME = "sample-episode-strong.txt";

/** High-risk messy chart — multiple integrity / LUPA / F2F issues */
export const SAMPLE_CHART_TEXT = `
HOME HEALTH EPISODE PACKET — SYNTHETIC DEMO (NO REAL PHI)
Agency: Prairie Summit Home Health
Patient: "Demo Patient A"  MRN: ****4821
SOC Date: 2026-06-02   Certification Period: 06/02/2026 – 07/31/2026
Primary Payer: Medicare Traditional  PDGM Timing: Early  Admission Source: Community

═══════════════════════════════════════════════════════════════
OASIS-E START OF CARE (partial)
═══════════════════════════════════════════════════════════════
M0020: Patient ID  ****4821
M0030: SOC Date  06/02/2026
M0069: Gender  F
M0066: Birth Date  **/**/1948
M0150: Current Payment Sources  1 - Medicare (traditional fee-for-service)
M1000: Inpatient facilities  NA - no inpatient stay within 14 days
M1021: Primary diagnosis  I50.9 Heart failure, unspecified
M1023a: Other diagnosis  E11.9 Type 2 diabetes mellitus without complications
M1023b: Other diagnosis  (blank)
M1033: Risk for Hospitalization  2 - History of falls (2 or more falls - or any fall with injury - in the past 12 months)
M1800: Grooming  1
M1810: Current Ability to Dress Upper Body  2
M1820: Current Ability to Dress Lower Body  2
M1830: Bathing  3
M1840: Toilet Transferring  1
M1850: Transferring  2
M1860: Ambulation/Locomotion  3 - Walks only with supervision or assistance of another person at all times
GG0130A: Eating  03
GG0130B: Oral hygiene  03
GG0130C: Toileting hygiene  02
GG0170C: Lying to sitting on side of bed  03
GG0170D: Sit to stand  02
GG0170E: Chair/bed-to-chair transfer  02
GG0170F: Toilet transfer  03
GG0170I: Walk 10 feet  02
GG0170J: Walk 50 feet with two turns  01
M1400: When is the patient dyspneic or noticeably Short of Breath?  2 - With moderate exertion
M2020: Management of Oral Medications  1 - Able to independently take the correct oral medication(s) and proper dosage(s) at the correct times
M2030: Management of Injectable Medications  NA
M1306: Unhealed Pressure Ulcer/Injury at Stage 2 or Higher  1 - Yes
M1311: Stage 2  Right heel  Length 2.1 cm Width 1.4 cm  (no depth documented)
M1322: Number of Stage 1 pressure injuries  0
M1324: Stage of Most Problematic Unhealed Pressure Ulcer  2

═══════════════════════════════════════════════════════════════
PHYSICIAN ORDERS / PLAN OF CARE
═══════════════════════════════════════════════════════════════
Orders dated: 06/01/2026
Skilled nursing: 2x/week x 4 weeks for cardiac assessment, medication teaching, wound care
PT: 2x/week x 3 weeks for gait training, transfer training, home safety
OT: evaluate and treat
Home health aide: 2x/week for personal care
Orders signed by: Dr. R. Patel  (electronic signature present)
 recertification orders: not present in packet

═══════════════════════════════════════════════════════════════
FACE-TO-FACE ENCOUNTER
═══════════════════════════════════════════════════════════════
F2F documentation: NOT FOUND in uploaded packet.
Clinical note references "PCP saw patient last month for CHF" without date, encounter details,
or relatedness to home health need.

═══════════════════════════════════════════════════════════════
HOMEBOUND STATUS
═══════════════════════════════════════════════════════════════
SOC narrative includes: "Patient tires with ambulation; uses walker."
No criteria 1 / criteria 2 structure documented. No statement that leaving home requires
considerable and taxing effort. No normal inability to leave home discussion.

═══════════════════════════════════════════════════════════════
SKILLED NURSING VISIT NOTES (summary)
═══════════════════════════════════════════════════════════════
Visit 1 (06/03): Vitals stable. CHF teaching initiated. Wound: right heel stage 2, clean,
no tunneling documented. Dressing: foam. Patient verbalized understanding of low-salt diet.
Visit 2 (06/06): Wound measurements not recorded. Dressing changed. Meds reviewed.
Visit 3 (06/10): Patient reports increased LE edema. Weight not compared to prior visit.
SN notes "continue POC" without reassessment of visit frequency.
Visits completed to date: 3 SN + 2 PT. Visits scheduled for 30-day period: 5 total skilled visits.
(Agency LUPA threshold for this HIPPS cluster typically 4–5 visits — borderline.)

═══════════════════════════════════════════════════════════════
WOUND DOCUMENTATION
═══════════════════════════════════════════════════════════════
Initial measurements present at SOC. No weekly measurement table. No photo timestamps.
No progression statement (improving / unchanged / declining). No physician notification
when edema increased. No offloading device documented for heel pressure injury.

═══════════════════════════════════════════════════════════════
NOTICE OF ADMISSION / TIMING
═══════════════════════════════════════════════════════════════
SOC 06/02/2026. NOA submission date: 06/09/2026 (day 7) — outside preferred 5-day window.
RAP/claim timing notes: none in packet.

═══════════════════════════════════════════════════════════════
COMORBIDITY / CODING SUPPORT
═══════════════════════════════════════════════════════════════
Narrative mentions "history of CKD stage 3" and "A-fib on anticoagulation" in free text
but M1023 secondary diagnoses do not capture N18.3 or I48.x. Diabetes listed without
complication codes despite wound on heel and neuropathy mentioned once in PT note.

═══════════════════════════════════════════════════════════════
SIGNATURES / CERTIFICATION
═══════════════════════════════════════════════════════════════
SOC comprehensive assessment signed by RN Sam Rivera 06/02/2026.
Assessing clinician: Sam Rivera, RN
Physician certification statement: partial — medical necessity checkbox marked;
homebound checkbox blank; estimated length of service blank.
`.trim();

/**
 * Strong documentation example — high readiness, low revenue-at-risk.
 * Used to show contrast vs the at-risk sample.
 */
export const SAMPLE_CLEAN_CHART_TEXT = `
HOME HEALTH EPISODE PACKET — SYNTHETIC DEMO STRONG DOCUMENTATION (NO REAL PHI)
Agency: Prairie Summit Home Health
Patient: "Demo Patient B"  MRN: ****7732
SOC Date: 2026-06-10   Certification Period: 06/10/2026 – 08/08/2026
Primary Payer: Medicare Traditional  PDGM Timing: Early  Admission Source: Institutional
HIPPS: 2AFKS

═══════════════════════════════════════════════════════════════
OASIS-E START OF CARE
═══════════════════════════════════════════════════════════════
M0020: ****7732
M0030: SOC Date  06/10/2026
M0150: 1 - Medicare (traditional fee-for-service)
M1000: 1 - Short-stay acute hospital (discharge 06/08/2026)
M1021: Primary diagnosis  I50.23 Acute on chronic systolic (congestive) heart failure
M1023a: I48.91 Unspecified atrial fibrillation
M1023b: N18.30 Chronic kidney disease, stage 3 unspecified
M1023c: E11.42 Type 2 diabetes mellitus with diabetic polyneuropathy
M1800: 2  M1810: 2  M1820: 3  M1830: 3  M1840: 2  M1850: 2
M1860: Ambulation/Locomotion  3 - Walks only with supervision or assistance at all times
GG0130A: 03  GG0130B: 03  GG0130C: 02
GG0170C: 03  GG0170D: 02  GG0170E: 02  GG0170F: 03
GG0170I: Walk 10 feet  02  GG0170J: Walk 50 feet with two turns  02
M1400: 2 - With moderate exertion
M2020: 2 - Able to take medication(s) at the correct times if given reminders
M1306: 0 - No

═══════════════════════════════════════════════════════════════
FACE-TO-FACE ENCOUNTER
═══════════════════════════════════════════════════════════════
F2F encounter date: 06/07/2026 (inpatient, day before discharge)
Practitioner: Dr. A. Nguyen, MD — related to primary reason for home health (CHF exacerbation).
Clinical findings: volume overload, EF 35%, new home oxygen evaluation deferred; home health SN/PT ordered.
Electronic signature present.

═══════════════════════════════════════════════════════════════
HOMEBOUND STATUS
═══════════════════════════════════════════════════════════════
Criteria 1: Requires assistance of another person to leave home; uses wheeled walker.
Criteria 2: Leaving home requires considerable and taxing effort due to dyspnea on exertion
and unsteady gait post-hospitalization. Absences from home are infrequent and short duration
for medical appointments.

═══════════════════════════════════════════════════════════════
PHYSICIAN ORDERS / PLAN OF CARE
═══════════════════════════════════════════════════════════════
Orders dated 06/09/2026; signed electronically by Dr. A. Nguyen 06/09/2026.
SN 3x/week x 2 weeks then 2x/week x 2 weeks: cardiac assessment, med teaching, weight monitoring.
PT 3x/week x 3 weeks: gait, transfer, endurance, home safety.
Certification complete: skilled need, homebound, POC established; estimated LOS 60 days.

═══════════════════════════════════════════════════════════════
SKILLED NURSING VISIT NOTES
═══════════════════════════════════════════════════════════════
Visits completed to date: 8 SN + 6 PT. Visits scheduled for 30-day period: 18 total skilled visits.
Visit notes document skilled need each visit (assessment, teaching with teach-back, response to POC).
Weights compared to prior visit; edema graded; physician notified day 4 for +3 lb with diuretic adjustment.
Wound: none. Medication reconciliation complete.

═══════════════════════════════════════════════════════════════
NOTICE OF ADMISSION
═══════════════════════════════════════════════════════════════
SOC 06/10/2026. NOA submitted 06/11/2026 (day 2) — within 5-day window.

═══════════════════════════════════════════════════════════════
SIGNATURES
═══════════════════════════════════════════════════════════════
SOC comprehensive assessment signed by RN Jordan Miles 06/10/2026.
Assessing clinician: Jordan Miles, RN
Physician certification fully completed and signed 06/09/2026.
`.trim();

export type SampleChartId = "at-risk" | "strong";

export function getSampleChart(id: SampleChartId): { fileName: string; text: string; label: string } {
  if (id === "strong") {
    return {
      fileName: SAMPLE_CLEAN_FILENAME,
      text: SAMPLE_CLEAN_CHART_TEXT,
      label: "Strong documentation sample",
    };
  }
  return {
    fileName: SAMPLE_CHART_FILENAME,
    text: SAMPLE_CHART_TEXT,
    label: "At-risk episode sample",
  };
}
