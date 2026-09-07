import type { Grade } from "@prisma/client";
import { gradeLabel } from "@/lib/grade";

export function DiagnosticTag({ grade, benchmarkScore, benchmarkLabel, wattageDraw, bootVerified }: {
  grade: Grade;
  benchmarkScore: number;
  benchmarkLabel: string;
  wattageDraw: number;
  bootVerified: boolean;
}) {
  return <dl className="diagnostic-rows">
    <div><dt>Condition</dt><dd>{gradeLabel[grade]} <span className="text-ink-dim">· Grade {grade}</span></dd></div>
    {(benchmarkLabel || benchmarkScore > 0) && <div><dt>{benchmarkLabel || "Benchmark"}</dt><dd>{benchmarkScore.toLocaleString()}</dd></div>}
    {wattageDraw > 0 && <div><dt>Draw under load</dt><dd>{wattageDraw} W</dd></div>}
    <div><dt>Boot verified</dt><dd className={bootVerified ? "text-pass" : "text-danger"}>{bootVerified ? "Pass" : "Fail"}</dd></div>
  </dl>;
}
