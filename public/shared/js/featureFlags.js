// ------------------------------------------------------------
// 00) Feature Flag Helpers
// ------------------------------------------------------------

(function () {
  function getFeatureFlag(name, fallback = false) {
    const features = window.STREAMTOOLS_CONFIG?.features || {};

    if (typeof features[name] === "boolean") {
      return features[name];
    }

    return fallback;
  }

  window.StreamToolsFeatureFlags = {
    getFeatureFlag
  };
})();
