"use client";
import { Input } from "@/components/ui/Field";

import type { Grade } from "@prisma/client";
import { gradeLabel, gradeDot } from "@/lib/grade";
import { useCurrency } from "@/components/CurrencyProvider";
import { convert } from "@/lib/exchangeRates";
import { formatMoney } from "@/lib/format";

const GRADES: Grade[] = ["A", "B", "C"];

// Canonical price buckets in USD. They're converted into the viewer's display
// currency below so the chip bounds line up with how prices are shown/filtered.
const BASE_PRICE_CHIPS = [
  { min: 0, max: 150 },
  { min: 150, max: 500 },
  { min: 500, max: 1500 },
  { min: 1500, max: Infinity },
];

const MIN_WATT = 50;
const MAX_WATT = 500;

export type FilterState = {
  grades: Grade[];
  countries: string[];
  priceMin: number | null;
  priceMax: number | null;
  maxWatt: number;
  verifiedOnly: boolean;
};

export function FilterSidebar({
  gradeCounts,
  countryCounts,
  grades,
  countries,
  priceMin,
  priceMax,
  maxWatt,
  verifiedOnly,
  onToggleGrade,
  onToggleCountry,
  onPriceMinChange,
  onPriceMaxChange,
  onMaxWattChange,
  onToggleVerified,
  onClearAll,
}: {
  gradeCounts: Partial<Record<Grade, number>>;
  countryCounts: { country: string; count: number }[];
  grades: Grade[];
  countries: string[];
  priceMin: number | null;
  priceMax: number | null;
  maxWatt: number;
  verifiedOnly: boolean;
  onToggleGrade: (grade: Grade) => void;
  onToggleCountry: (country: string) => void;
  onPriceMinChange: (value: number | null) => void;
  onPriceMaxChange: (value: number | null) => void;
  onMaxWattChange: (value: number) => void;
  onToggleVerified: () => void;
  onClearAll: () => void;
}) {
  const { displayCurrency, rates } = useCurrency();

  // Convert the USD bucket bounds into the display currency (rounded) so the chip
  // labels and the amounts they apply match how prices are shown and compared.
  const toDisplay = (usd: number) =>
    usd === Infinity ? Infinity : convert(usd, "USD", displayCurrency, rates) ?? usd;
  const priceChips = BASE_PRICE_CHIPS.map(({ min, max }) => {
    const dMin = toDisplay(min);
    const dMax = toDisplay(max);
    const label =
      min === 0
        ? `Under ${formatMoney(dMax, displayCurrency)}`
        : max === Infinity
          ? `${formatMoney(dMin, displayCurrency)}+`
          : `${formatMoney(dMin, displayCurrency)}–${formatMoney(dMax, displayCurrency)}`;
    return { label, min: dMin, max: dMax };
  });

  return (
    <div className="filter-sidebar">
      <div className="filter-sidebar-head">
        <p className="text-[16px] font-medium">Filters</p>
        <button
          type="button"
          onClick={onClearAll}
          className="font-body text-[11.5px] text-ink-dim underline underline-offset-2 hover:text-accent transition-colors"
        >
          Clear all
        </button>
      </div>

      <details className="border-b border-line group" open>
        <summary className="list-none flex items-center justify-between px-4 py-3 text-[13.5px] font-semibold cursor-pointer">
          Grade
          <Chevron />
        </summary>
        <div className="px-4 pb-4 flex flex-col gap-2.5">
          {GRADES.map((g) => (
            <label
              key={g}
              className="flex items-center gap-2.5 text-[13.5px] cursor-pointer hover:text-accent transition-colors"
            >
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent"
                checked={grades.includes(g)}
                onChange={() => onToggleGrade(g)}
              />
              <span className={`w-2 h-2 rounded-sm shrink-0 ${gradeDot[g]}`} />
              <span>
                {g} - {gradeLabel[g]}
              </span>
              <span className="ml-auto font-body text-[11.5px] text-ink-dim">
                {gradeCounts[g] ?? 0}
              </span>
            </label>
          ))}
        </div>
      </details>

      <details className="border-b border-line group" open>
        <summary className="list-none flex items-center justify-between px-4 py-3 text-[13.5px] font-semibold cursor-pointer">
          Price
          <span className="ml-auto mr-2 font-body text-[11px] font-normal text-ink-dim">
            {displayCurrency}
          </span>
          <Chevron />
        </summary>
        <div className="px-4 pb-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              aria-label="Minimum price"
              placeholder="Min"
              value={priceMin ?? ""}
              onChange={(e) => onPriceMinChange(e.target.value === "" ? null : Number(e.target.value))}
            />
            <span className="text-ink-dim text-xs">—</span>
            <Input
              type="number"
              min={0}
              aria-label="Maximum price"
              placeholder="Max"
              value={priceMax ?? ""}
              onChange={(e) => onPriceMaxChange(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {priceChips.map((chip) => {
              const active = priceMin === chip.min && priceMax === (chip.max === Infinity ? null : chip.max);
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    if (active) {
                      onPriceMinChange(null);
                      onPriceMaxChange(null);
                    } else {
                      onPriceMinChange(chip.min);
                      onPriceMaxChange(chip.max === Infinity ? null : chip.max);
                    }
                  }}
                  aria-pressed={active}
                  className={`text-[12px] px-3 py-2 rounded-full border transition-colors ${
                    active
                      ? "border-accent text-accent"
                      : "border-line text-ink-dim hover:border-accent hover:text-accent"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </details>

      <details className="border-b border-line group">
        <summary className="list-none flex items-center justify-between px-4 py-3 text-[13.5px] font-semibold cursor-pointer">
          Draw under load
          <Chevron />
        </summary>
        <div className="px-4 pb-4">
          <input
            type="range"
            aria-label="Maximum draw under load"
            min={MIN_WATT}
            max={MAX_WATT}
            step={10}
            value={maxWatt}
            onChange={(e) => onMaxWattChange(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between font-body text-[11.5px] text-ink-dim mt-1">
            <span>{MIN_WATT}W</span>
            <span>{maxWatt >= MAX_WATT ? `≤ ${MAX_WATT}W` : `≤ ${maxWatt}W`}</span>
          </div>
        </div>
      </details>

      <details className="border-b border-line group" open>
        <summary className="list-none flex items-center justify-between px-4 py-3 text-[13.5px] font-semibold cursor-pointer">
          Diagnostic proof
          <Chevron />
        </summary>
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onToggleVerified}
            role="switch"
            aria-checked={verifiedOnly}
            className="w-full flex items-center justify-between text-[13.5px]"
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-pass" />
              Verified only
            </span>
            <span
              className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${
                verifiedOnly ? "bg-pass" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-bg-elevated transition-transform ${
                  verifiedOnly ? "translate-x-4" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </details>

      {countryCounts.length > 0 && (
        <details className="group">
          <summary className="list-none flex items-center justify-between px-4 py-3 text-[13.5px] font-semibold cursor-pointer">
            Location
            <Chevron />
          </summary>
          <div className="px-4 pb-4 flex flex-col gap-2.5">
            {countryCounts.map(({ country, count }) => (
              <label
                key={country}
                className="flex items-center gap-2.5 text-[13.5px] cursor-pointer hover:text-accent transition-colors"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-accent"
                  checked={countries.includes(country)}
                  onChange={() => onToggleCountry(country)}
                />
                <span>{country}</span>
                <span className="ml-auto font-body text-[11.5px] text-ink-dim">{count}</span>
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <span className="w-2 h-2 border-r-[1.5px] border-b-[1.5px] border-ink-dim rotate-45 group-open:-rotate-135 transition-transform shrink-0" />
  );
}
