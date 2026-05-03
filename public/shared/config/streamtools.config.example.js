// ------------------------------------------------------------
// StreamTools Shared Browser Config Example
// ------------------------------------------------------------
// Copy this file to streamtools.config.js for local/workshop use.
// By default it follows the host and port that served the widget.

(function () {
  const locationIsHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  const serverProtocol = locationIsHttp ? window.location.protocol.replace(":", "") : "http";
  const serverHost = locationIsHttp ? window.location.hostname : "localhost";
  const serverPort = locationIsHttp ? window.location.port : "3030";
  const serverBaseUrl = serverPort
    ? `${serverProtocol}://${serverHost}:${serverPort}`
    : `${serverProtocol}://${serverHost}`;

  window.STREAMTOOLS_CONFIG = {
    server: {
      protocol: serverProtocol,
      host: serverHost,
      port: serverPort,
      baseUrl: serverBaseUrl,
      apiBase: "/api",
      widgetBase: "/widgets",
      sharedBase: "/shared"
    },

    urls: {
      health: `${serverBaseUrl}/health`,
      apiHealth: `${serverBaseUrl}/api/health`,
      widgetRoot: `${serverBaseUrl}/widgets/`,
      sharedRoot: `${serverBaseUrl}/shared/`
    },

    brand: {
      name: "StreamTools",
      primaryColor: "#1e7bff",
      accentColor: "#00d4ff",
      warningColor: "#ffcc00",
      dangerColor: "#ff3b3b"
    },

    defaults: {
      refreshIntervalMs: 1000,
      animationSpeedMs: 300,
      enableSounds: true,
      enableAnimations: true
    },

    debug: {
      enabled: false,
      showDebugBadge: false,
      logApiCalls: false,
      logWidgetState: false,
      showMockDataControls: false
    },

    features: {
      useSharedTheme: true,
      preloadAssets: true,
      allowDemoMode: false
    }
  };
})();
