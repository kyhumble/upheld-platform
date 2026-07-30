"use client";

import { useActionState } from "react";
import {
  runManifestBatchAction,
  runSampleBatchAction,
  type BatchActionState,
} from "@/server/actions/batch";
import { Button, Card, Input, Label, Textarea } from "./ui";

const initial: BatchActionState = {};

export function SampleBatchButton() {
  const [state, action, pending] = useActionState(runSampleBatchAction, initial);

  return (
    <form action={action}>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Running sample retrospective…" : "Run sample retrospective (5 claims)"}
      </Button>
      {state.error ? <p className="mt-2 text-xs text-danger">{state.error}</p> : null}
      {pending ? (
        <p className="mt-2 text-xs text-muted">
          Analyzing labeled denials, LUPA, and paid-clean episodes — usually under a minute.
        </p>
      ) : null}
    </form>
  );
}

export function BatchUploadForm() {
  const [state, action, pending] = useActionState(runManifestBatchAction, initial);

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-navy">Upload already-processed claims</h2>
      <p className="mt-1 text-sm text-muted">
        Point this at claims that already paid, denied, LUPA&apos;d, or took a takeback — we re-run
        integrity analysis and score{" "}
        <strong className="text-navy">would-have-caught</strong> before submission.
      </p>

      <form action={action} className="mt-4 space-y-4">
        <div>
          <Label htmlFor="batch-name">Batch name</Label>
          <Input
            id="batch-name"
            name="name"
            placeholder="Q2 denials + LUPA sample · 100 claims"
            disabled={pending}
          />
        </div>

        <div>
          <Label htmlFor="batch-file">CSV or ZIP (up to ~200 claims · 40 MB)</Label>
          <Input
            id="batch-file"
            name="file"
            type="file"
            accept=".csv,.zip,text/csv,application/zip"
            disabled={pending}
          />
          <p className="mt-1 text-[11px] text-muted">
            ZIP: include <code className="text-navy">outcomes.csv</code> + episode .txt/.pdf files.
            Large jobs process in chunks (leave tab open). Export CSV from the results page for board
            decks.
          </p>
        </div>

        <div>
          <Label htmlFor="manifestCsv">Or paste CSV manifest</Label>
          <Textarea
            id="manifestCsv"
            name="manifestCsv"
            rows={8}
            disabled={pending}
            placeholder={`claimId,outcome,knownLossUsd,knownReason,chartText
CLM-1001,DENIED,2038,Face-to-face missing,"...episode text..."
CLM-1002,LUPA,1100,Low skilled visits,"..."
CLM-1003,PAID_CLEAN,0,,"..."`}
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Running batch analysis…" : "Run retrospective analysis"}
        </Button>
        {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
        {pending ? (
          <p className="text-xs text-muted">
            Processing in parallel (multi-pass per claim). Keep this tab open for large batches.
          </p>
        ) : null}
      </form>
    </Card>
  );
}
