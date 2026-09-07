import type { Grade } from "@prisma/client";

export const gradeLabel: Record<Grade, string> = {
  A: "Like New",
  B: "Good",
  C: "Fair",
};

export const gradeDot: Record<Grade, string> = {
  A: "bg-pass",
  B: "bg-ink-dim",
  C: "bg-warning",
};
