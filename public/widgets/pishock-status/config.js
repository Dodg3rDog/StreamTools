// ------------------------------------------------------------
// PiShock Status Widget Config
// ------------------------------------------------------------

window.WIDGET_CONFIG = {
  widgetName: "pishock-status",

  controls: {
    enabled: true,
    demoMode: false
  },

  api: {
    statusEndpoint: "/api/pishock/status",
    refreshIntervalMs: 1000
  },

  display: {
    defaultMode: "full",
    transparentBackground: false,
    bootEnabled: true,
    radialPressureStyle: "segmented",
    radialFrameEnabled: true,
    radialPillEnabled: true
  },

  debug: {
    enabled: false,
    logStatusPayloads: false
  }
};
