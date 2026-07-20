"use client";

import { CSRF_COOKIE, CSRF_HEADER } from "./csrf-constants";

export function readCsrfCookie(): string {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : "";
}

export type BffError = { status: number; message: string };

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === "string") return err;
  }
  return fallback;
}

/** POST to a BFF route with the double-submit CSRF header attached. */
export async function bffPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [CSRF_HEADER]: readCsrfCookie(),
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await parseBody(res);
  if (!res.ok) {
    throw {
      status: res.status,
      message: messageFrom(data, `Request failed (${res.status})`),
    } satisfies BffError;
  }
  return data as T;
}

export async function bffGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  const data = await parseBody(res);
  if (!res.ok) {
    throw {
      status: res.status,
      message: messageFrom(data, `Request failed (${res.status})`),
    } satisfies BffError;
  }
  return data as T;
}
