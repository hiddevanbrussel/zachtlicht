(function () {
  "use strict";

  var APP = "/media/developer/apps/usr/palm/applications/org.local.zachtlicht";
  var state = {
    autostart: false,
    met: true,
    artic: true,
    rijks: false,
    rijksKey: "",
    imageSize: 640,
    veil: 0.45,
    durationSec: 90,
    foreign: false,
    ours: false,
    qmlExists: true
  };

  var statusNode = document.getElementById("status");
  var autostartButton = document.getElementById("autostart");
  var applyButton = document.getElementById("apply");
  var revertButton = document.getElementById("revert");
  var testButton = document.getElementById("test");
  var refreshButton = document.getElementById("refresh");
  var metButton = document.getElementById("met");
  var articButton = document.getElementById("artic");
  var rijksButton = document.getElementById("rijks");
  var keyInput = document.getElementById("rijksKey");

  function setStatus(text) {
    statusNode.textContent = text;
  }

  function near(value, target) {
    return Math.abs(Number(value) - target) < 0.02;
  }

  function responseText(res) {
    var parts = [];
    if (res && res.stdoutString && String(res.stdoutString).replace(/^\s+|\s+$/g, "")) {
      parts.push(String(res.stdoutString).replace(/^\s+|\s+$/g, ""));
    }
    if (res && res.stderrString && String(res.stderrString).replace(/^\s+|\s+$/g, "")) {
      parts.push(String(res.stderrString).replace(/^\s+|\s+$/g, ""));
    }
    if (!parts.length && res && res.errorText) {
      parts.push(String(res.errorText));
    }
    var text = parts.join("\n");
    if (!text) {
      return "Klaar.";
    }
    if (text.length > 700) {
      return text.substring(0, 700);
    }
    return text;
  }

  function bridgeMissing(res) {
    return res && res.errorText && String(res.errorText).indexOf("WebOSServiceBridge") !== -1;
  }

  function exec(command, callback) {
    window.webOS.service.request("luna://org.webosbrew.hbchannel.service", {
      method: "exec",
      parameters: { command: command },
      onSuccess: function (res) { callback(true, res); },
      onFailure: function (res) { callback(false, res); }
    });
  }

  function script(name, arg) {
    var command = "sh '" + APP + "/assets/" + name + "'";
    if (arg) {
      command += " " + arg;
    }
    return command;
  }

  function buildSaveCommand() {
    var key = state.rijksKey.replace(/^\s+|\s+$/g, "");
    if (key === "") {
      key = "-";
    }
    if (key !== "-" && !/^[A-Za-z0-9]+$/.test(key)) {
      return { error: "De Rijksmuseum-sleutel mag alleen letters en cijfers bevatten." };
    }
    if (!state.met && !state.artic && !state.rijks) {
      return { error: "Kies minstens één museum." };
    }
    if (state.rijks && key === "-") {
      return { error: "Vul een Rijksmuseum-sleutel in, of zet Rijksmuseum uit." };
    }
    var veil = String(Math.round(state.veil * 100));
    var parts = [
      state.met ? "1" : "0",
      state.artic ? "1" : "0",
      state.rijks ? "1" : "0",
      key,
      String(state.imageSize),
      veil,
      String(state.durationSec)
    ];
    var i;
    for (i = 0; i < parts.length; i += 1) {
      if (!/^[A-Za-z0-9.-]+$/.test(parts[i])) {
        return { error: "Ongeldige instelling." };
      }
    }
    return { command: script("save.sh", parts.join(" ")) };
  }

  function markRadios(group, value) {
    var buttons = document.querySelectorAll('[data-group="' + group + '"]');
    var i;
    for (i = 0; i < buttons.length; i += 1) {
      buttons[i].setAttribute("aria-checked", buttons[i].getAttribute("data-value") === value ? "true" : "false");
    }
  }

  function sourceLabel(name, on) {
    var title = "Metropolitan Museum";
    if (name === "artic") {
      title = "Art Institute of Chicago";
    }
    if (name === "rijks") {
      title = "Rijksmuseum";
    }
    return title + ": " + (on ? "aan" : "uit");
  }

  function render() {
    autostartButton.textContent = state.autostart ? "Autostart: aan" : "Autostart: uit";
    autostartButton.setAttribute("aria-pressed", state.autostart ? "true" : "false");
    metButton.textContent = sourceLabel("met", state.met);
    metButton.setAttribute("aria-pressed", state.met ? "true" : "false");
    articButton.textContent = sourceLabel("artic", state.artic);
    articButton.setAttribute("aria-pressed", state.artic ? "true" : "false");
    rijksButton.textContent = sourceLabel("rijks", state.rijks);
    rijksButton.setAttribute("aria-pressed", state.rijks ? "true" : "false");
    markRadios("veil", String(state.veil));
    markRadios("size", String(state.imageSize));
    markRadios("duration", String(state.durationSec));
    applyButton.disabled = !state.qmlExists;
    autostartButton.disabled = !state.qmlExists;
    if (document.activeElement !== keyInput) {
      keyInput.value = state.rijksKey;
    }
  }

  function describe(status) {
    if (!status.qmlExists) {
      return "Op deze tv staat geen QML-screensaver. Zachtlicht is voor webOS 5 tot en met 23.";
    }
    if (status.foreign) {
      return "Er staat nog een andere screensaver op dit bestand (" + (status.mountedSource || "onbekend") + "). Inschakelen vervangt die door Zachtlicht.";
    }
    var parts = [];
    parts.push(status.ours ? "Zachtlicht staat aan." : "Zachtlicht staat uit.");
    parts.push(status.autostart ? "Autostart staat aan." : "Autostart staat uit.");
    if (status.playlistCount) {
      parts.push(status.playlistCount + " werken in de collectie.");
    } else {
      parts.push("Nog geen collectie. Ververs die zodra de tv online is.");
    }
    return parts.join(" ");
  }

  function applyStatus(status) {
    var settings = status.settings || {};
    state.autostart = !!status.autostart;
    state.foreign = !!status.foreign;
    state.ours = !!status.ours;
    state.qmlExists = status.qmlExists !== false;
    if (typeof settings.met === "boolean") {
      state.met = settings.met;
    }
    if (typeof settings.artic === "boolean") {
      state.artic = settings.artic;
    }
    if (typeof settings.rijks === "boolean") {
      state.rijks = settings.rijks;
    }
    if (typeof settings.rijksKey === "string") {
      state.rijksKey = settings.rijksKey;
    }
    if (settings.imageSize === 320 || settings.imageSize === 640 || settings.imageSize === 960) {
      state.imageSize = settings.imageSize;
    }
    if (near(settings.veil, 0.25) || near(settings.veil, 0.45) || near(settings.veil, 0.65)) {
      state.veil = Math.round(Number(settings.veil) * 100) / 100;
    }
    if (settings.durationSec === 45 || settings.durationSec === 90 || settings.durationSec === 180) {
      state.durationSec = settings.durationSec;
    }
    render();
    setStatus(describe(status));
  }

  function load() {
    exec(script("status.sh"), function (ok, res) {
      if (!ok || !res || !res.stdoutString) {
        render();
        if (bridgeMissing(res)) {
          setStatus("Geen tv-verbinding. Je kunt de knoppen hier bekijken. Toepassen kan alleen op de televisie.");
          return;
        }
        setStatus("Status ophalen mislukt.\n" + responseText(res) + "\nDit lukt alleen op een geroote tv met Homebrew Channel.");
        return;
      }
      try {
        applyStatus(JSON.parse(res.stdoutString));
      } catch (error) {
        render();
        setStatus("Onleesbare status van de tv.\n" + responseText(res));
      }
    });
  }

  function persist(callback) {
    var built = buildSaveCommand();
    if (built.error) {
      setStatus(built.error);
      if (callback) {
        callback(false);
      }
      return;
    }
    setStatus("Instellingen opslaan…");
    exec(built.command, function (ok, res) {
      if (!ok) {
        if (bridgeMissing(res)) {
          setStatus("Geen tv-verbinding. Open Zachtlicht op de televisie.");
        } else {
          setStatus(responseText(res));
        }
        if (callback) {
          callback(false);
        }
        return;
      }
      if (callback) {
        callback(true);
      }
    });
  }

  function runSaved(command, pending) {
    persist(function (saved) {
      if (!saved) {
        return;
      }
      setStatus(pending);
      exec(command, function (ok, res) {
        setStatus(responseText(res));
        if (ok) {
          load();
        }
      });
    });
  }

  function selectChoice(button) {
    var group = button.getAttribute("data-group");
    var value = button.getAttribute("data-value");
    if (group === "veil") {
      state.veil = Number(value);
    } else if (group === "size") {
      state.imageSize = parseInt(value, 10);
    } else if (group === "duration") {
      state.durationSec = parseInt(value, 10);
    }
    markRadios(group, value);
  }

  function toggleSource(name, button) {
    state[name] = !state[name];
    button.textContent = sourceLabel(name, state[name]);
    button.setAttribute("aria-pressed", state[name] ? "true" : "false");
  }

  function focusables() {
    var nodes = document.querySelectorAll(".focusable");
    var list = [];
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      if (nodes[i].disabled) {
        continue;
      }
      list.push(nodes[i]);
    }
    return list;
  }

  function groupOf(element) {
    if (!element || !element.getAttribute) {
      return "";
    }
    return element.getAttribute("data-group") || "";
  }

  function move(direction) {
    var list = focusables();
    var current = document.activeElement;
    var index = -1;
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i] === current) {
        index = i;
      }
    }
    if (index === -1) {
      if (list.length) {
        list[0].focus();
      }
      return;
    }
    var group = groupOf(current);
    var step = direction > 0 ? 1 : -1;
    index += step;
    while (index >= 0 && index < list.length) {
      if (!group || groupOf(list[index]) !== group) {
        list[index].focus();
        return;
      }
      index += step;
    }
  }

  function moveGroup(current, direction) {
    var group = groupOf(current);
    if (!group) {
      return;
    }
    var nodes = document.querySelectorAll('[data-group="' + group + '"]');
    var list = [];
    var index = -1;
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      list.push(nodes[i]);
      if (nodes[i] === current) {
        index = i;
      }
    }
    var next = index + direction;
    if (next < 0 || next >= list.length) {
      return;
    }
    list[next].focus();
    selectChoice(list[next]);
  }

  document.addEventListener("keydown", function (event) {
    var key = event.key;
    var target = event.target;
    if (target && target.tagName === "INPUT") {
      if (key === "ArrowUp" || key === "ArrowDown") {
        event.preventDefault();
        move(key === "ArrowDown" ? 1 : -1);
      }
      return;
    }
    if (key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (key === "ArrowRight") {
      event.preventDefault();
      moveGroup(target, 1);
    } else if (key === "ArrowLeft") {
      event.preventDefault();
      moveGroup(target, -1);
    }
  });

  autostartButton.addEventListener("click", function () {
    var next = state.autostart ? "off" : "on";
    if (next === "off") {
      setStatus("Autostart uitzetten…");
      exec(script("autostart.sh", "off"), function (ok, res) {
        setStatus(responseText(res));
        if (ok) {
          load();
        }
      });
      return;
    }
    runSaved(script("autostart.sh", "on"), "Autostart aanzetten…");
  });

  applyButton.addEventListener("click", function () {
    runSaved(script("apply.sh"), "Zachtlicht inschakelen…");
  });

  revertButton.addEventListener("click", function () {
    setStatus("LG-screensaver terugzetten…");
    exec(script("revert.sh"), function (ok, res) {
      setStatus(responseText(res));
      if (ok || (res && res.stderrString)) {
        load();
      }
    });
  });

  testButton.addEventListener("click", function () {
    runSaved(
      "luna-send -n 1 'luna://com.webos.service.tvpower/power/turnOnScreenSaver' '{}'",
      "Screensaver starten…"
    );
  });

  refreshButton.addEventListener("click", function () {
    runSaved(script("refresh.sh"), "Collectie ophalen…");
  });

  metButton.addEventListener("click", function () {
    toggleSource("met", metButton);
  });
  articButton.addEventListener("click", function () {
    toggleSource("artic", articButton);
  });
  rijksButton.addEventListener("click", function () {
    toggleSource("rijks", rijksButton);
  });

  keyInput.addEventListener("input", function () {
    state.rijksKey = keyInput.value;
  });

  var choiceButtons = document.querySelectorAll("[data-group]");
  var c;
  for (c = 0; c < choiceButtons.length; c += 1) {
    choiceButtons[c].addEventListener("click", function (event) {
      selectChoice(event.currentTarget);
    });
  }

  render();
  if (focusables().length) {
    focusables()[0].focus();
  }
  load();
})();
