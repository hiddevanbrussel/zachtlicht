var fs = require("fs");
var path = require("path");

var VEILS = {
  "25": 0.25,
  "45": 0.45,
  "65": 0.65,
  "0.25": 0.25,
  "0.45": 0.45,
  "0.65": 0.65
};

var SIZES = {
  "320": 320,
  "640": 640,
  "960": 960
};

var DURATIONS = {
  "45": 45,
  "90": 90,
  "180": 180
};

function dataDir() {
  return process.env.ZACHTLICHT_DATA || "/var/lib/webosbrew/zachtlicht";
}

function defaults() {
  return {
    met: true,
    artic: true,
    rijks: false,
    rijksKey: "",
    imageSize: 640,
    veil: 0.45,
    durationSec: 90
  };
}

function flag(value) {
  if (value === true || value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === false || value === 0 || value === "0" || value === "false") {
    return false;
  }
  throw new Error("Ongeldige bronkeuze.");
}

function lookup(table, value, message) {
  var text = String(value);
  if (Object.prototype.hasOwnProperty.call(table, text)) {
    return table[text];
  }
  throw new Error(message);
}

function veilOf(value) {
  var text = String(value);
  if (Object.prototype.hasOwnProperty.call(VEILS, text)) {
    return VEILS[text];
  }
  var asPercent = String(Math.round(Number(value) * 100));
  if (Object.prototype.hasOwnProperty.call(VEILS, asPercent)) {
    return VEILS[asPercent];
  }
  throw new Error("Ongeldige sluier.");
}

function sanitize(input) {
  var settings = defaults();
  var key = input.rijksKey || "";
  if (key === "-") {
    key = "";
  }
  if (key !== "" && !/^[A-Za-z0-9]+$/.test(key)) {
    throw new Error("De Rijksmuseum-sleutel mag alleen letters en cijfers bevatten.");
  }
  if (key.length > 80) {
    throw new Error("De Rijksmuseum-sleutel is te lang.");
  }
  settings.met = flag(input.met);
  settings.artic = flag(input.artic);
  settings.rijks = flag(input.rijks);
  settings.rijksKey = key;
  settings.imageSize = lookup(SIZES, input.imageSize, "Ongeldige wazigheid.");
  settings.veil = veilOf(input.veil);
  settings.durationSec = lookup(DURATIONS, input.durationSec, "Ongeldige tijd.");
  if (!settings.met && !settings.artic && !settings.rijks) {
    throw new Error("Kies minstens één museum.");
  }
  if (settings.rijks && settings.rijksKey === "") {
    throw new Error("Vul een Rijksmuseum-sleutel in, of zet Rijksmuseum uit.");
  }
  return settings;
}

function mkdirp(dir) {
  var abs = path.resolve(dir);
  var parts = abs.split(path.sep);
  var acc = parts[0];
  var i;
  for (i = 1; i < parts.length; i += 1) {
    acc = path.join(acc, parts[i]);
    if (!fs.existsSync(acc)) {
      fs.mkdirSync(acc);
    }
  }
}

function save(settings) {
  var dir = dataDir();
  mkdirp(dir);
  var file = path.join(dir, "settings.json");
  var tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(settings));
  fs.renameSync(tmp, file);
  return settings;
}

function read() {
  var file = path.join(dataDir(), "settings.json");
  if (!fs.existsSync(file)) {
    return defaults();
  }
  try {
    var raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return sanitize({
      met: raw.met,
      artic: raw.artic,
      rijks: raw.rijks,
      rijksKey: raw.rijksKey || "",
      imageSize: raw.imageSize,
      veil: raw.veil,
      durationSec: raw.durationSec
    });
  } catch (error) {
    return defaults();
  }
}

module.exports = {
  dataDir: dataDir,
  defaults: defaults,
  sanitize: sanitize,
  save: save,
  read: read,
  mkdirp: mkdirp
};
