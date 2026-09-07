import type { ComponentProps } from "react";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`ui-input ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`ui-input ui-select ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`ui-input ui-textarea ${className}`} {...props} />;
}

export function FieldLabel({ className = "", ...props }: ComponentProps<"label">) {
  return <label className={`ui-label ${className}`} {...props} />;
}
