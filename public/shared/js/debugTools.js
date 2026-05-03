// ------------------------------------------------------------
// 00) Debug Helpers
// ------------------------------------------------------------

(function () {
  function isDebugEnabled(widgetConfig = window.WIDGET_CONFIG || {}) {
    return (
      widgetConfig?.debug?.enabled === true ||
      window.STREAMTOOLS_CONFIG?.debug?.enabled === true
    );
  }

  function debugLog(scope, ...args) {
    if (!isDebugEnabled()) return;

    console.log(`[${scope || "StreamTools"}]`, ...args);
  }

  function showDebugBadge(label = "DEBUG MODE") {
    if (document.querySelector(".st-debug-badge")) return;

    const badge = document.createElement("div");
    badge.className = "st-debug-badge";
    badge.textContent = label;
    document.body.appendChild(badge);
  }

  window.StreamToolsDebug = {
    isDebugEnabled,
    debugLog,
    showDebugBadge
  };
})();
