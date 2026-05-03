// ------------------------------------------------------------
// PiShock Status Widget Config Example
// ------------------------------------------------------------
// Copy this file to config.js and adjust local widget settings.

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
    bootEnabled: true
  },

  debug: {
    enabled: false,
    logStatusPayloads: false
  }
};
