/*
 * Minimale webOS-brug voor Zachtlicht.
 * Zelfde aanroep als webOSTV.js: webOS.service.request(uri, { method, parameters, onSuccess, onFailure }).
 */
(function (window) {
  "use strict";

  function request(uri, options) {
    var settings = options || {};
    var method = settings.method || "";
    var parameters = settings.parameters || {};
    var onSuccess = settings.onSuccess || function () {};
    var onFailure = settings.onFailure || function () {};

    if (typeof window.WebOSServiceBridge !== "function") {
      onFailure({
        returnValue: false,
        errorText: "WebOSServiceBridge ontbreekt."
      });
      return;
    }

    var bridge = new window.WebOSServiceBridge();
    bridge.onservicecallback = function (message) {
      var response;
      try {
        response = JSON.parse(message);
      } catch (error) {
        onFailure({
          returnValue: false,
          errorText: "Ongeldig antwoord van de tv."
        });
        return;
      }
      if (response && response.returnValue) {
        onSuccess(response);
      } else {
        onFailure(response || {
          returnValue: false,
          errorText: "De tv-aanroep is mislukt."
        });
      }
    };
    bridge.call(uri + "/" + method, JSON.stringify(parameters));
  }

  window.webOS = window.webOS || {};
  window.webOS.service = { request: request };
})(window);
