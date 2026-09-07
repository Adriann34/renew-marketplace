import Link from "next/link";
import type { ComponentProps } from "react";

type ButtonStyle = {
  variant?: "primary" | "secondary" | "quiet" | "danger" | "danger-outline";
  size?: "default" | "small" | "icon";
};

function buttonClass({ variant = "primary", size = "default", className = "" }: ButtonStyle & { className?: string }) {
  return `ui-button ui-button-${variant} ui-button-${size} ${className}`;
}

export function Button({ variant, size, className, type = "button", ...props }: ComponentProps<"button"> & ButtonStyle) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}
