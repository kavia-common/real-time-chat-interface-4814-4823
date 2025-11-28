//
// Environment utility helpers for resolving API and WebSocket endpoints
// PUBLIC helpers are annotated with PUBLIC_INTERFACE doc comments.
//

/**
 * Safely reads a Create React App style environment variable.
 * CRA only exposes variables prefixed with REACT_APP_ to the client bundle.
 * @param {string} name - The full env var name (e.g., 'REACT_APP_API_BASE')
 * @returns {string|undefined}
 */
function readEnv(name) {
  try {
    // eslint-disable-next-line no-undef
    return process && process.env ? process.env[name] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Normalizes a base URL by removing trailing slashes.
 * @param {string} url
 * @returns {string}
 */
function normalizeBase(url) {
  if (!url) return url;
  return url.replace(/\/+$/, "");
}

/**
 * Infers protocol (http/https) from window, defaults to https if not available.
 * @returns {'http:'|'https:'}
 */
function getPageProtocol() {
  if (typeof window !== "undefined" && window.location && window.location.protocol) {
    return window.location.protocol === "http:" ? "http:" : "https:";
  }
  return "https:";
}

/**
 * Builds an absolute URL from a possibly relative base and path.
 * @param {string} base
 * @param {string} path
 * @returns {string}
 */
function joinUrl(base, path) {
  const b = normalizeBase(base || "");
  if (!path) return b;
  if (!b) return path;
  return `${b}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Derives the host (hostname:port) from window.location, or returns empty string in non-browser envs.
 * @returns {string}
 */
function getPageHost() {
  if (typeof window !== "undefined" && window.location) {
    return window.location.host;
  }
  return "";
}

/**
 * Derives the origin from window.location, or uses a sensible default for SSR/tests.
 * @returns {string}
 */
function getPageOrigin() {
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  const protocol = getPageProtocol();
  const host = getPageHost() || "localhost:3000";
  return `${protocol}//${host}`;
}

/**
 * Derives the websocket protocol (ws or wss) from page protocol.
 * @returns {'ws'|'wss'}
 */
function getWsScheme() {
  return getPageProtocol() === "http:" ? "ws" : "wss";
}

/**
 * Computes a best-effort API base URL using:
 * 1) REACT_APP_API_BASE
 * 2) REACT_APP_BACKEND_URL
 * 3) Fallback to current origin
 * Ensures no trailing slash.
 */
// PUBLIC_INTERFACE
export function getApiBase() {
  /** This helper returns the base URL to call the REST API. */
  const explicit = readEnv("REACT_APP_API_BASE");
  const backend = readEnv("REACT_APP_BACKEND_URL");
  const chosen = explicit || backend || getPageOrigin();
  return normalizeBase(chosen);
}

/**
 * Computes a best-effort front-end public URL using:
 * 1) REACT_APP_FRONTEND_URL
 * 2) window.location.origin
 * @returns {string}
 */
function getFrontendUrl() {
  const fe = readEnv("REACT_APP_FRONTEND_URL");
  return normalizeBase(fe || getPageOrigin());
}

/**
 * Computes a WebSocket URL using the following precedence:
 * 1) REACT_APP_WS_URL (as-is)
 * 2) If REACT_APP_API_BASE is set and is absolute, swap scheme http<->ws and keep host/path
 * 3) If REACT_APP_BACKEND_URL is set, same scheme swap
 * 4) Otherwise, use window.location with ws/wss and optional '/ws' path
 * In all cases, returns an absolute ws:// or wss:// URL.
 */
// PUBLIC_INTERFACE
export function getWsUrl() {
  /** This helper returns the WebSocket endpoint absolute URL. */
  const explicit = readEnv("REACT_APP_WS_URL");
  if (explicit) {
    return explicit;
  }

  const apiBase = readEnv("REACT_APP_API_BASE");
  const backend = readEnv("REACT_APP_BACKEND_URL");
  const candidate = apiBase || backend;

  if (candidate && /^https?:\/\//i.test(candidate)) {
    try {
      const u = new URL(candidate);
      const scheme = u.protocol === "http:" ? "ws:" : "wss:";
      // Preserve any path on API base; if none, default to /ws for common backends
      const path = u.pathname && u.pathname !== "/" ? u.pathname : "/ws";
      const wsUrl = `${scheme}//${u.host}${path}`;
      return wsUrl;
    } catch {
      // If URL parsing fails, fall back to window-based computation
    }
  }

  // Derive from current page location
  const host = getPageHost() || "localhost:3000";
  const scheme = getWsScheme();
  // Default common websocket path
  const path = "/ws";
  return `${scheme}://${host}${path}`;
}

/**
 * Returns a boolean indicating if the app is running in production mode.
 */
// PUBLIC_INTERFACE
export function isProduction() {
  /** Returns true when REACT_APP_NODE_ENV is 'production' */
  const env = readEnv("REACT_APP_NODE_ENV");
  return (env || "").toLowerCase() === "production";
}

/**
 * Returns structured environment information useful across the app.
 */
// PUBLIC_INTERFACE
export function getEnvSummary() {
  /** Provides a small snapshot of resolved environment values for debugging. */
  return {
    apiBase: getApiBase(),
    wsUrl: getWsUrl(),
    frontendUrl: getFrontendUrl(),
    nodeEnv: readEnv("REACT_APP_NODE_ENV") || "development",
    logLevel: readEnv("REACT_APP_LOG_LEVEL") || "info",
    featureFlags: readEnv("REACT_APP_FEATURE_FLAGS") || "",
  };
}

/**
 * Builds a full API URL from a given path, resolving against getApiBase().
 * @param {string} path - e.g., '/health' or 'health'
 * @returns {string}
 */
// PUBLIC_INTERFACE
export function apiUrl(path = "") {
  /** Join a path to the API base URL (normalized). */
  return joinUrl(getApiBase(), path);
}

/**
 * Returns the health check path configured via REACT_APP_HEALTHCHECK_PATH or defaults to '/health'.
 */
// PUBLIC_INTERFACE
export function getHealthcheckPath() {
  /** Returns a health check path (relative) */
  return readEnv("REACT_APP_HEALTHCHECK_PATH") || "/health";
}

export default {
  getApiBase,
  getWsUrl,
  isProduction,
  getEnvSummary,
  apiUrl,
  getHealthcheckPath,
};
