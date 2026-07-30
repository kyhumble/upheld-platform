/**
 * Run Free Chart Scan golden eval suite.
 *
 *   npm run eval
 */
import { runEvalSuite } from "../src/domain/chart-scan/eval";
import { GOLDEN_CASES } from "../src/domain/chart-scan/eval-fixtures";

async function main() {
  const suite = await runEvalSuite(GOLDEN_CASES);
  for (const r of suite.results) {
    const mark = r.pass ? "PASS" : "FAIL";
    console.log(
      `[${mark}] ${r.id} readiness=${r.readiness} protect=$${r.revenueAtRisk} capture=$${r.revenueUpside} findings=${r.findingCount}`,
    );
    if (!r.pass) {
      for (const f of r.failures) console.log(`   - ${f}`);
    }
  }
  console.log(`\n${suite.passed} passed · ${suite.failed} failed · ${GOLDEN_CASES.length} total`);
  if (suite.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
