import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
  CMS_PER_VISIT_RATES_2026,
  CMS_LUPA_ILLUSTRATIVE_GAP,
  CMS_REFS,
} from "@/domain/chart-scan/knowledge";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader } from "./ui";

export function CmsRateCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-muted">
        CMS CY {CMS_PAYMENT_YEAR} national 30-day base{" "}
        <a href="/trust" className="font-semibold text-navy hover:text-teal hover:underline">
          {formatCurrency(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT)}
        </a>{" "}
        · SN per-visit{" "}
        <a href="/trust" className="font-medium text-navy hover:text-teal hover:underline">
          {formatCurrency(CMS_PER_VISIT_RATES_2026.skilledNursing)}
        </a>{" "}
        · LUPA gap{" "}
        <a href="/trust" className="font-medium text-danger hover:underline">
          {formatCurrency(CMS_LUPA_ILLUSTRATIVE_GAP)}
        </a>{" "}
        ·{" "}
        <a href="/trust" className="font-semibold text-teal hover:underline">
          rate details →
        </a>
      </p>
    );
  }

  return (
    <Card>
      <CardHeader
        title={`CMS CY ${CMS_PAYMENT_YEAR} rate anchors`}
        subtitle="National standardized amounts · not a remittance or grouper"
        action={
          <a href="/trust" className="text-xs font-semibold text-teal hover:underline">
            Trust →
          </a>
        }
      />
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        <a
          href="/trust"
          className="rounded-lg border border-transparent p-2 transition hover:border-teal/30 hover:bg-mist/50"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            30-day period base
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-navy">
            {formatCurrency(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">Quality data submitters</p>
        </a>
        <a
          href="/trust"
          className="rounded-lg border border-transparent p-2 transition hover:border-teal/30 hover:bg-mist/50"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            SN per-visit (LUPA)
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-navy">
            {formatCurrency(CMS_PER_VISIT_RATES_2026.skilledNursing)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            PT {formatCurrency(CMS_PER_VISIT_RATES_2026.physicalTherapy)}
          </p>
        </a>
        <a
          href="/issues?money=EXPOSURE"
          className="rounded-lg border border-transparent p-2 transition hover:border-danger/30 hover:bg-red-50/50"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Illustrative LUPA gap
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-danger">
            {formatCurrency(CMS_LUPA_ILLUSTRATIVE_GAP)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">Period − (5 × SN) · view protect issues</p>
        </a>
      </div>
      <p className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted">
        {CMS_REFS.HH_PPS_CY2026}. Actual payment = base × case-mix weight × wage index. Upheld
        estimates are advisory only.
      </p>
    </Card>
  );
}
