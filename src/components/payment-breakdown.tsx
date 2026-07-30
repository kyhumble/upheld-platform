import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
} from "@/domain/chart-scan/knowledge";
import type { PaymentEstimateSummary } from "@/domain/chart-scan/types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, Badge } from "./ui";

export function PaymentBreakdown({
  payment,
  capture,
  protect,
}: {
  payment?: PaymentEstimateSummary | null;
  capture: number;
  protect: number;
}) {
  if (!payment) {
    return (
      <Card>
        <CardHeader
          title="Period payment model"
          subtitle="Re-run analysis on a new scan to populate chart-specific case-mix estimate"
        />
        <p className="px-5 py-4 text-sm text-muted">
          Expected period defaults to CMS CY {CMS_PAYMENT_YEAR} national base{" "}
          {formatCurrency(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT)} until signals are inferred.
        </p>
      </Card>
    );
  }

  const e = payment.expectedPeriodPayment;
  const national = payment.nationalBase || CMS_NATIONAL_30_DAY_PERIOD_PAYMENT;

  return (
    <Card>
      <CardHeader
        title="How expected period $ was calculated"
        subtitle="Advisory PDGM-style model · not a certified grouper"
        action={
          <a href="/calculations" className="text-xs font-semibold text-teal hover:underline">
            Full method →
          </a>
        }
      />
      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="navy">{payment.method}</Badge>
          <Badge tone={payment.confidence === "HIGH" ? "ok" : payment.confidence === "MEDIUM" ? "teal" : "warn"}>
            {payment.confidence} confidence
          </Badge>
          {payment.hippsHint ? <Badge tone="neutral">HIPPS {payment.hippsHint}</Badge> : null}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[520px] text-left text-sm">
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-2.5 text-muted">CMS CY {payment.paymentYear} national base</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy">
                  {formatCurrency(national)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-muted">
                  Case-mix weight
                  <span className="mt-0.5 block text-[11px]">
                    Group {payment.clinicalGroupFamily} · comorbidity {payment.comorbidityBand.toLowerCase()} ·
                    function {payment.functionalBand.toLowerCase()} · timing{" "}
                    {payment.timing.toLowerCase()} · admission {payment.admissionSource.toLowerCase()}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy">
                  × {payment.caseMixWeight.toFixed(3)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-muted">
                  Wage index
                  {payment.wageIndex === 1 ? (
                    <span className="mt-0.5 block text-[11px]">National default (set agency wage index in Settings)</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy">
                  × {payment.wageIndex.toFixed(3)}
                </td>
              </tr>
              <tr className="bg-mist/50">
                <td className="px-4 py-3 font-semibold text-navy">Expected 30-day period total</td>
                <td className="px-4 py-3 text-right text-lg font-bold tabular-nums text-navy">
                  {formatCurrency(e)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-ok">Capture (recoverable if fixed)</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ok">
                  +{formatCurrency(capture)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-danger">Protect (at risk if submitted)</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-danger">
                  {formatCurrency(protect)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          {payment.basis}. Capture and protect are scaled to this period total and capped by it. Actual
          remittance uses full CMS HIPPS tables and MAC processing — this is Clinical Revenue Integrity
          decision support only. A certification period may include two 30-day payments.
        </p>
      </div>
    </Card>
  );
}
