"use client";

const PASS_KEY = "lienguard.passcode";
const NAME_KEY = "lienguard.actor";

function read(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function getIdentity(): { passcode: string; actor: string } {
  return { passcode: read(PASS_KEY), actor: read(NAME_KEY) };
}

export function setIdentity(passcode: string, actor: string): void {
  try {
    sessionStorage.setItem(PASS_KEY, passcode);
    sessionStorage.setItem(NAME_KEY, actor);
  } catch {
    // storage unavailable: values only live for this page view
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
  }
}

/** POST with the demo passcode and reviewer name attached. */
export async function post<T = unknown>(url: string, body?: FormData | object): Promise<T> {
  const { passcode, actor } = getIdentity();
  const headers: Record<string, string> = { "x-demo-passcode": passcode, "x-demo-actor": actor };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method: "POST", headers, body: payload });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    const msg = res.status === 401 ? "Enter the demo passcode (top right) to make changes." : (json.error ?? `Request failed (${res.status})`);
    throw new ApiError(msg, res.status, json);
  }
  return json as T;
}
