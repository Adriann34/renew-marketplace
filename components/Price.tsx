"use client";

import { useCurrency } from "@/components/CurrencyProvider";
import { formatApprox, formatMoney } from "@/lib/format";
import { getCurrencyMeta } from "@/lib/currency";

/**
 * The one component every listing price renders through. Given the seller's real
 * price and its currency, it shows the amount converted into the viewer's currency
 * as the primary figure — but explicitly marked approximate (≈, tooltip) with the
 * seller's real price kept visible underneath. So the buyer sees a number they
 * understand, yet can never mistake the estimate for the true asking price.
 *
 * When the listing is already in the viewer's currency (or rates are unavailable),
 * it just shows the real price with no ≈ and no secondary line.
 */
export function Price({
  amount,
  currency,
  className = "",
  align = "left",
  secondaryClassName = "",
}: {
  amount: number;
  currency: string;
  /** Classes for the primary figure (size etc.); base font-body tabular-nums text-ink is applied. */
  className?: string;
  align?: "left" | "right";
  secondaryClassName?: string;
}) {
  const { displayCurrency, toDisplay } = useCurrency();

  const converted = currency === displayCurrency ? null : toDisplay(amount, currency);
  const realFormatted = formatMoney(amount, currency);

  // Same currency, or conversion unavailable → show the real price only.
  if (converted == null) {
    return <span className={`font-body tabular-nums text-ink ${className}`}>{realFormatted}</span>;
  }

  const tooltip = `Approximate — converted at today's exchange rate. The seller is asking ${realFormatted} (${getCurrencyMeta(currency).name}).`;

  return (
    <span
      className={`inline-flex flex-col ${align === "right" ? "items-end" : "items-start"}`}
      title={tooltip}
    >
      <span className={`font-body tabular-nums text-ink ${className}`}>
        {formatApprox(converted, displayCurrency)}
      </span>
      <span className={`font-body tabular-nums text-[12px] text-ink-dim leading-tight ${secondaryClassName}`}>
        {realFormatted}
      </span>
    </span>
  );
}
