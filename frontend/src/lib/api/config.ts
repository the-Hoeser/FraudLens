/**
 * Backend configuration. VITE_API_BASE_URL is a public build-time value (it ends up in
 * the browser bundle), so it must only ever hold a URL — never a key or token.
 */
export function normalizeBaseUrl(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function getApiBaseUrl(): string | null {
  return normalizeBaseUrl(import.meta.env["VITE_API_BASE_URL"] as string | undefined);
}

/** The raw env value, for the settings page to explain an invalid URL. */
export function getRawApiBaseUrl(): string | null {
  const raw = import.meta.env["VITE_API_BASE_URL"] as string | undefined;
  return raw && raw.trim() !== "" ? raw.trim() : null;
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl() !== null;
}