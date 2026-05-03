// ------------------------------------------------------------
// 00) Widget Utilities
// ------------------------------------------------------------

(function () {
  function getConfigValue(path, fallback) {
    const keys = String(path || "").split(".").filter(Boolean);
    const sources = [
      window.WIDGET_CONFIG || {},
      window.STREAMTOOLS_CONFIG || {}
    ];

    for (const source of sources) {
      let value = source;

      for (const key of keys) {
        value = value?.[key];
      }

      if (value !== undefined) {
        return value;
      }
    }

    return fallback;
  }

  function formatTimeRemaining(ms) {
    const totalSeconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  window.StreamToolsWidgetUtils = {
    getConfigValue,
    formatTimeRemaining
  };
})();
