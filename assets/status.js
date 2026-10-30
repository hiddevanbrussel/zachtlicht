var fs = require("fs");
var path = require("path");
var model = require("./settings-model.js");

var MOUNT_TARGET = "/usr/palm/applications/com.webos.app.screensaver/qml/main.qml";
var LINK = "/var/lib/webosbrew/init.d/50-zachtlicht";
var OURS = "/org.local.zachtlicht/assets/screensaver-main.qml";

function mountSource() {
  var text;
  try {
    text = fs.readFileSync("/proc/mounts", "utf8");
  } catch (error) {
    return "";
  }
  var lines = text.split("\n");
  var i;
  for (i = 0; i < lines.length; i += 1) {
    var fields = lines[i].split(" ");
    if (fields.length >= 2 && fields[1] === MOUNT_TARGET) {
      return fields[0].split("\\040").join(" ");
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
