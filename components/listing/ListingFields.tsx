import type { ReactNode } from "react";
import type { Category } from "@prisma/client";
import { Input, Select, Textarea, FieldLabel } from "@/components/ui/Field";
import { LocationAutocomplete } from "@/components/listing/LocationAutocomplete";
import type { PreviewFields } from "@/components/listing/ListingPreviewCard";
import { categoryDiagnosticTier, categoryLabels, categorySpecPlaceholder, categoryTitlePlaceholder } from "@/lib/category";
import { gradeLabel } from "@/lib/grade";
import { CURRENCIES } from "@/lib/currency";

type ListingFieldsProps = {
  category: Category;
  fields: PreviewFields;
  onChange: (patch: Partial<PreviewFields>) => void;
};

export function ListingBasics({ category, fields, onChange, description = "", editing = false }: ListingFieldsProps & {
  description?: string;
  editing?: boolean;
}) {
  return <section className="form-section space-y-6">
    <h2>Listing details</h2>
    {editing && <div><span className="ui-label">Category</span><p className="text-[14px] text-ink py-2">{categoryLabels[category]}</p></div>}
    <div>
      <FieldLabel htmlFor="title">Title</FieldLabel>
      <Input id="title" name="title" required defaultValue={fields.title} placeholder={categoryTitlePlaceholder[category]} onChange={(e) => onChange({ title: e.target.value })} />
    </div>
    <div>
      <FieldLabel htmlFor="price">Price</FieldLabel>
      <div className="flex gap-2">
        <Select name="currency" aria-label="Currency" value={fields.currency} onChange={(e) => onChange({ currency: e.target.value })} className="ui-input-currency">
          {CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code}</option>)}
        </Select>
        <Input id="price" name="price" type="number" min={0} required defaultValue={fields.price} placeholder="1450" onChange={(e) => onChange({ price: e.target.value })} />
      </div>
      {!editing && <p className="text-[12px] text-ink-dim mt-2 leading-relaxed">Set the price in your own currency. Buyers see a converted estimate alongside your asking price.</p>}
    </div>
    <div>
      <FieldLabel htmlFor="spec">Spec</FieldLabel>
      <Input id="spec" name="spec" required defaultValue={fields.spec} placeholder={categorySpecPlaceholder[category]} onChange={(e) => onChange({ spec: e.target.value })} />
    </div>
    <div>
      <FieldLabel htmlFor="location">Location</FieldLabel>
      <LocationAutocomplete name="location" initialValue={fields.location} onValueChange={(location) => onChange({ location })} />
    </div>
    <fieldset>
      <legend className="ui-label">Condition</legend>
      <div className="grid grid-cols-3 gap-2">
        {(["A", "B", "C"] as const).map((grade) => <div key={grade}>
          <input id={`grade-${grade}`} type="radio" name="grade" required value={grade} checked={fields.grade === grade} onChange={() => onChange({ grade })} className="peer sr-only" />
          <label htmlFor={`grade-${grade}`} className="condition-option">{gradeLabel[grade]}</label>
        </div>)}
      </div>
    </fieldset>
    <div>
      <FieldLabel htmlFor="description">Description</FieldLabel>
      <Textarea id="description" name="description" required maxLength={2000} rows={5} defaultValue={description} placeholder="What’s included, why you’re selling, and anything the next owner should know." />
    </div>
  </section>;
}

export function ListingDiagnostics({ category, fields, onChange, children }: ListingFieldsProps & { children?: ReactNode }) {
  const tier = categoryDiagnosticTier[category];
  return <section className="form-section space-y-6">
    <h2>Diagnostic report</h2>
    {children}
    {tier === "full" && <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <FieldLabel htmlFor="benchmarkLabel">Benchmark name</FieldLabel>
        <Input id="benchmarkLabel" name="benchmarkLabel" required value={fields.benchmarkLabel} placeholder="Time Spy" onChange={(e) => onChange({ benchmarkLabel: e.target.value })} />
      </div>
      <div>
        <FieldLabel htmlFor="benchmarkScore">Benchmark score</FieldLabel>
        <Input id="benchmarkScore" name="benchmarkScore" type="number" min={0} required value={fields.benchmarkScore} placeholder="18340" onChange={(e) => onChange({ benchmarkScore: e.target.value })} />
      </div>
    </div>}
    {(tier === "full" || tier === "wattage-boot") && <div>
      <FieldLabel htmlFor="wattageDraw">Draw under load (W)</FieldLabel>
      <Input id="wattageDraw" name="wattageDraw" type="number" min={0} required value={fields.wattageDraw} placeholder="0 if not applicable" onChange={(e) => onChange({ wattageDraw: e.target.value })} />
    </div>}
    <div className="flex items-center justify-between gap-6">
      <div><label htmlFor="bootVerified" className="ui-label mb-1">Boots and POSTs reliably</label><p className="text-[12px] text-ink-dim leading-relaxed">Confirms this part powers on and is recognized by the system every time.</p></div>
      <label className="relative inline-flex items-center w-10 h-5.5 shrink-0 cursor-pointer">
        <input id="bootVerified" type="checkbox" name="bootVerified" checked={fields.bootVerified} onChange={(e) => onChange({ bootVerified: e.target.checked })} className="peer sr-only" />
        <span className="switch-track" /><span className="switch-thumb" />
      </label>
    </div>
  </section>;
}
