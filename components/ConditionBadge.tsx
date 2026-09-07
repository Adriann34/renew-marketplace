import type { Grade } from "@prisma/client";
import { gradeLabel } from "@/lib/grade";

export function ConditionBadge({ grade }: { grade: Grade }) {
  return <span className="listing-condition" title={`Condition grade ${grade}`}>{gradeLabel[grade]}</span>;
}
