var fs = require("fs");
var path = require("path");
var model = require("./settings-model.js");

var MOUNT_TARGET = "/usr/palm/applications/com.webos.app.screensaver/qml/main.qml";
var LINK = "/var/lib/webosbrew/init.d/50-zachtlicht";
var OURS = "/org.local.zachtlicht/assets/screensaver-main.qml";

function unescapeMount(text) {
  return String(text || "").split("\\040").join(" ");
}

function mountSource() {
  var text;
  var lines;
  var i;
  var fields;
  var root;
  var mp;
  var last = "";

  try {
    text = fs.readFileSync("/proc/self/mountinfo", "utf8");
    lines = text.split("\n");
    for (i = 0; i < lines.length; i += 1) {
      if (!lines[i]) {
        continue;
      }
      fields = lines[i].split(" ");
      if (fields.length < 5) {
        continue;
      }
      root = unescapeMount(fields[3]);
      mp = unescapeMount(fields[4]);
      if (mp === MOUNT_TARGET) {
        last = root;
      }
    }
    if (last) {
      return last;
    }
  } catch (error) {
    last = "";
  }

  try {
    text = fs.readFileSync("/proc/mounts", "utf8");
  } catch (error) {
    return "";
  }
  lines = text.split("\n");
  for (i = 0; i < lines.length; i += 1) {
    fields = lines[i].split(" ");
    if (fields.length >= 2 && unescapeMount(fields[1]) === MOUNT_TARGET) {
      return unescapeMount(fields[0]);
    }
  }
  return "";
}

function autostartOn() {
  var applyPath = path.join(__dirname, "apply.sh");
  try {
    var st = fs.lstatSync(LINK);
    if (st.isSymbolicLink()) {
      var target = fs.readlinkSync(LINK);
      return target === applyPath || target.indexOf(OURS.replace("/screensaver-main.qml", "/apply.sh")) !== -1;
    }
    var text = fs.readFileSync(LINK, "utf8");
    return text.indexOf("/org.local.zachtlicht/assets/apply.sh") !== -1;
  } catch (error) {
    return false;
  }
}

function playlistInfo() {
  var file = path.join(model.dataDir(), "playlist.json");
  if (!fs.existsSync(file)) {
    return { playlistCount: 0, fetchedAt: "" };
  }
  try {
    var data = JSON.parse(fs.readFileSync(file, "utf8"));
    var count = data && data.items && data.items.length ? data.items.length : 0;
    return {
      playlistCount: count,
      fetchedAt: data && data.fetchedAt ? String(data.fetchedAt) : ""
    };
  } catch (error) {
    return { playlistCount: 0, fetchedAt: "" };
  }
}

var source = mountSource();
var ours = source.indexOf(OURS) !== -1;
var playlist = playlistInfo();
var qmlExists = false;
try {
  qmlExists = fs.existsSync(MOUNT_TARGET);
} catch (error) {
  qmlExists = false;
}

var status = {
  ok: true,
  mounted: source !== "",
  ours: ours,
  foreign: source !== "" && !ours,
  mountedSource: source,
  autostart: autostartOn(),
  qmlExists: qmlExists,
  playlistCount: playlist.playlistCount,
  fetchedAt: playlist.fetchedAt,
  settings: model.read()
};

process.stdout.write(JSON.stringify(status));
