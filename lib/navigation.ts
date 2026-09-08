const INTERNAL_ORIGIN = "https://renew.local";

export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return false;
  }

  try {
    return new URL(path, INTERNAL_ORIGIN).origin === INTERNAL_ORIGIN;
  } catch {
    return false;
  }
}

export function safeInternalPath(
  path: string | null | undefined,
  fallback = "/"
): string {
  return isSafeInternalPath(path) ? path : fallback;
}
