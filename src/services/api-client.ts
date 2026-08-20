// Thin backend API client. Adds the /api prefix and (optionally) a Bearer
// token. Never logs tokens. Throws ApiError with a status so callers can
// distinguish network failure (status 0) from auth failure (401).

import { BACKEND_URL } from "@/src/constants/config";

export interface BackendUser {
  user_id: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  auth_provider: string;
}

export interface SessionResult {
  session_token: string;
  user: BackendUser;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const url = `${BACKEND_URL}/api${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Network unavailable");
  }

  if (!res.ok) {
    let detail = res.statusText || "Request failed";
    try {
      const j = await res.json();
      if (j && typeof j.detail === "string") detail = j.detail;
    } catch {
      // ignore body parse errors
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const api = {
  createSession(sessionId: string) {
    return request<SessionResult>("/auth/session", {
      method: "POST",
      body: { session_id: sessionId },
    });
  },
  me(token: string) {
    return request<BackendUser>("/auth/me", { token });
  },
  logout(token: string) {
    return request<{ ok: boolean }>("/auth/logout", { method: "POST", token });
  },
};
