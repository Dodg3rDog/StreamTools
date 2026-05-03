// ------------------------------------------------------------
// 00) API Client
// ------------------------------------------------------------

(function () {
  function getApiUrl(path) {
    const server = window.STREAMTOOLS_CONFIG?.server || {};
    const baseUrl = server.baseUrl || "";
    const apiBase = server.apiBase || "/api";
    const normalizedPath = String(path || "").startsWith("/")
      ? String(path || "")
      : `/${path || ""}`;

    if (normalizedPath.startsWith(apiBase)) {
      return `${baseUrl}${normalizedPath}`;
    }

    return `${baseUrl}${apiBase}${normalizedPath}`;
  }

  async function request(path, options = {}) {
    const response = await fetch(getApiUrl(path), {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.error || `Request failed with ${response.status}`;
      throw new Error(message);
    }

    return data;
  }

  window.StreamToolsApi = {
    getApiUrl,
    request
  };
})();
