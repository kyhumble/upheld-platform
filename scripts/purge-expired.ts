/**
 * Purge expired FREE chart scans.
 *
 *   npx tsx scripts/purge-expired.ts           # dry-run
 *   npx tsx scripts/purge-expired.ts --execute
 */
import "dotenv/config";
import { purgeExpiredFreeScans } from "../src/lib/purge";

async function main() {
  const execute = process.argv.includes("--execute");
  const result = await purgeExpiredFreeScans({ dryRun: !execute });
  console.log(JSON.stringify(result, null, 2));
  if (!execute) {
    console.log("\nDry run only. Pass --execute to delete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
