"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "imposter.sessionId";
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let cachedSessionId: string | null = null;

function getClientSnapshot(): string {
  if (cachedSessionId) return cachedSessionId;
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id || !UUID_V4_REGEX.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  cachedSessionId = id;
  return id;
}

const subscribe = () => () => {};

/** Anonymous device identity: a v4 UUID persisted in localStorage. Null during SSR. */
export function useSessionId(): string | null {
  return useSyncExternalStore(subscribe, getClientSnapshot, () => null);
}
