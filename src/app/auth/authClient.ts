import type { DemoRole } from "../../core/types/roles";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8789";
const GET_CACHE_TTL_MS = 5 * 60_000;
const API_CONNECTION_ERROR =
  "No se pudo conectar con la API. Verifica la conexion, el dominio o que el servidor este disponible.";

type CachedJson = {
  expiresAt: number;
  value?: unknown;
  promise?: Promise<unknown>;
};

const getCache = new Map<string, CachedJson>();
const cacheVersions = new Map<string, number>();

export type AuthenticatedSession = {
  sessionToken: string;
  expiresAt: string;
  user: {
    userId: string;
    email: string;
    displayName: string;
    roles: DemoRole[];
    capabilities: string[];
  };
  tenant: {
    tenantId: string;
    companyName: string;
  };
};

export type LoginInput = {
  tenantId: string;
  email: string;
  password: string;
};

export type PublicTenantBranding = {
  tenantId: string;
  tenantSlug: string;
  companyName: string;
  locale: string;
  appLanguage: string;
  logoUrl: string;
};

type SessionContextResponse = {
  session: {
    expiresAt?: string;
    tenant: AuthenticatedSession["tenant"];
    actor: {
      userId: string;
      email?: string;
      displayName?: string;
      roles?: DemoRole[];
      role?: DemoRole;
      capabilities: string[];
    };
  };
};

export type LoginResponse =
  | ({ code?: undefined } & AuthenticatedSession)
  | {
      code: "MFA_SETUP_REQUIRED";
      message: string;
      mfaSetupToken: string;
      expiresAt: string;
    }
  | {
      code: "MFA_REQUIRED";
      message: string;
      mfaChallengeToken: string;
      expiresAt: string;
    };

export type TotpSetupResponse = {
  factorId: string;
  secret: string;
  otpauthUri: string;
};

export async function login(input: LoginInput): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: input,
  });
}

export async function setupTotp(input: { mfaSetupToken: string; label?: string }): Promise<TotpSetupResponse> {
  return requestJson<TotpSetupResponse>("/api/auth/mfa/totp/setup", {
    method: "POST",
    body: input,
  });
}

export async function verifyTotp(input: {
  mfaSetupToken?: string;
  mfaChallengeToken?: string;
  factorId?: string;
  code: string;
}): Promise<AuthenticatedSession> {
  return requestJson<AuthenticatedSession>("/api/auth/mfa/totp/verify", {
    method: "POST",
    body: input,
  });
}

export async function getCurrentSession(sessionToken?: string): Promise<AuthenticatedSession> {
  const response = await requestJson<SessionContextResponse>("/api/auth/session", {
    method: "GET",
    token: sessionToken || undefined,
  });
  const roles = response.session.actor.roles || (response.session.actor.role ? [response.session.actor.role] : []);
  return {
    sessionToken: sessionToken || "",
    expiresAt: response.session.expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    tenant: response.session.tenant,
    user: {
      userId: response.session.actor.userId,
      email: response.session.actor.email || "",
      displayName: response.session.actor.displayName || "Usuario",
      roles,
      capabilities: response.session.actor.capabilities || [],
    },
  };
}

export async function logout(sessionToken?: string): Promise<void> {
  await requestJson<{ status: string }>("/api/auth/logout", {
    method: "POST",
    token: sessionToken || undefined,
    body: {},
  });
}

export async function getPublicTenantBranding(tenantSlug: string): Promise<PublicTenantBranding> {
  const response = await requestJson<{ branding: PublicTenantBranding }>(
    `/api/public/tenant-branding?tenantSlug=${encodeURIComponent(tenantSlug)}`,
    {
      method: "GET",
    },
  );
  return response.branding;
}

export async function requestJson<T>(
  path: string,
  options: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    token?: string;
  },
): Promise<T> {
  const cacheToken = options.token || (path.startsWith("/api/public/") ? "public" : "cookie");
  const cacheKey = shouldCacheGet(path, options) ? `${cacheToken}:${path}` : "";
  const cacheVersion = getCacheVersion(cacheToken);
  if (cacheKey) {
    const cached = getCache.get(cacheKey);
    if (cached?.value !== undefined && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
    if (cached?.promise) {
      return cached.promise as Promise<T>;
    }
  }

  const requestPromise = fetchJson<T>(path, options);
  if (cacheKey) {
    getCache.set(cacheKey, {
      expiresAt: Date.now() + GET_CACHE_TTL_MS,
      promise: requestPromise,
    });
  }

  try {
    const payload = await requestPromise;
    if (cacheKey) {
      if (getCacheVersion(cacheToken) === cacheVersion) {
        getCache.set(cacheKey, {
          expiresAt: Date.now() + GET_CACHE_TTL_MS,
          value: payload,
        });
      }
    } else if (options.method !== "GET") {
      invalidateApiCache(options.token || "cookie");
      dispatchMutationToast(path, options.method);
    }
    return payload;
  } catch (error) {
    if (cacheKey) {
      getCache.delete(cacheKey);
    }
    throw error;
  }
}

function dispatchMutationToast(path: string, method: string) {
  if (path.startsWith("/api/auth/")) {
    return;
  }
  const message = mutationToastMessage(path, method);
  window.dispatchEvent(new CustomEvent("constriqo:toast", {
    detail: {
      tone: "success",
      message,
    },
  }));
}

function mutationToastMessage(path: string, method: string) {
  if (path.startsWith("/api/crm/clients") && method === "POST") return "Cliente creado correctamente.";
  if (path.startsWith("/api/crm/clients") && method === "PATCH") return "Cliente actualizado correctamente.";
  if (path.startsWith("/api/workforce/workers") && method === "POST") return "Trabajador creado correctamente.";
  if (path.startsWith("/api/workforce/workers") && method === "PATCH") return "Trabajador actualizado correctamente.";
  if (path.startsWith("/api/workforce/worker-users")) return "Acceso de trabajador creado correctamente.";
  if (path.startsWith("/api/jobs") && method === "POST") return "Registro de obra guardado correctamente.";
  if (path.startsWith("/api/jobs") && method === "PATCH") return "Obra actualizada correctamente.";
  if (path.startsWith("/api/estimates") && path.includes("/send-email")) return "Correo de cotizacion preparado en sandbox.";
  if (path.startsWith("/api/estimates")) return "Cotizacion guardada correctamente.";
  if (path.startsWith("/api/invoicing") && path.includes("/send-email")) return "Correo de factura preparado en sandbox.";
  if (path.startsWith("/api/invoicing")) return "Factura actualizada correctamente.";
  if (path.startsWith("/api/finance") || path.startsWith("/api/expenses")) return "Movimiento guardado correctamente.";
  if (path.startsWith("/api/assets")) return "Activo guardado correctamente.";
  if (path.startsWith("/api/liabilities")) return "Pasivo guardado correctamente.";
  if (path.startsWith("/api/services/prices")) return "Servicio guardado correctamente.";
  if (path.startsWith("/api/marketing")) return "Marketing actualizado correctamente.";
  if (path.startsWith("/api/organization")) return "Configuracion guardada correctamente.";
  if (path.startsWith("/api/documents")) return "Archivo actualizado correctamente.";
  if (path.startsWith("/api/attendance")) return "Jornada actualizada correctamente.";
  return "Cambios guardados correctamente.";
}

export async function warmApiCache(
  token: string,
  paths: string[],
  options: { concurrency?: number } = {},
): Promise<void> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const concurrency = Math.max(1, Math.min(options.concurrency || 3, 6));
  let cursor = 0;

  async function worker() {
    while (cursor < uniquePaths.length) {
      const path = uniquePaths[cursor];
      cursor += 1;
      await requestJson(path, { method: "GET", token }).catch(() => null);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, uniquePaths.length) }, () => worker()));
}

async function fetchJson<T>(
  path: string,
  options: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    token?: string;
  },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error(API_CONNECTION_ERROR);
  }
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : "No se pudo completar la solicitud.";
    throw new Error(message);
  }

  return payload as T;
}

function shouldCacheGet(
  path: string,
  options: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    token?: string;
  },
) {
  return options.method === "GET" && !path.startsWith("/api/auth/") && !path.startsWith("/api/public/");
}

export function invalidateApiCache(token?: string, pathPrefix?: string): void {
  if (token) {
    cacheVersions.set(token, getCacheVersion(token) + 1);
  } else {
    for (const cacheToken of Array.from(cacheVersions.keys())) {
      cacheVersions.set(cacheToken, getCacheVersion(cacheToken) + 1);
    }
  }
  for (const key of Array.from(getCache.keys())) {
    const matchesToken = !token || key.startsWith(`${token}:`);
    const matchesPath = !pathPrefix || key.includes(`:${pathPrefix}`);
    if (matchesToken && matchesPath) {
      getCache.delete(key);
    }
  }
}

function getCacheVersion(token: string) {
  return cacheVersions.get(token) || 0;
}

export function peekCachedJson<T>(token: string, path: string): T | null {
  const cacheToken = token || "cookie";
  const cached = getCache.get(`${cacheToken}:${path}`);
  if (cached?.value !== undefined && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }
  return null;
}

export async function requestBlob(
  path: string,
  options: {
    method: "GET" | "POST";
    token?: string;
  },
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method,
      credentials: "include",
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
    });
  } catch {
    throw new Error(API_CONNECTION_ERROR);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.message === "string" ? payload.message : "No se pudo descargar el documento.";
    throw new Error(message);
  }

  return response.blob();
}

export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function openBlobInDocumentViewer(blob: Blob, filename: string): boolean {
  const documentBlob = blob.type ? blob : new Blob([blob], { type: "application/pdf" });
  const url = URL.createObjectURL(documentBlob);
  const openedWindow = window.open(url, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    saveBlobAsFile(blob, filename);
    URL.revokeObjectURL(url);
    return false;
  }

  openedWindow.focus();
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return true;
}
