// ------------------------------------------------------------
// StreamTools Shared Browser Config Live Server Example
// ------------------------------------------------------------
// Copy this file to streamtools.config.js on the live web server.
// Keep that active streamtools.config.js out of repo sync/deploys.

(function () {
  const serverProtocol = "http";
  const serverHost = "192.168.1.131";
  const serverPort = "3030";
  const serverBaseUrl = `${serverProtocol}://${serverHost}:${serverPort}`;

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
