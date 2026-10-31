(function () {
  "use strict";

  var DURATION = 13000;
  var CROSSFADE = 2000;
  var imageSize = 640;
  var veil = 0.45;
  var works = [];
  var index = 0;
  var pass = 0;
  var showingA = true;
  var hasShown = false;
  var misses = 0;
  var holdTimer = 0;

  var layerA = document.getElementById("layer-a");
  var layerB = document.getElementById("layer-b");
  var frameA = document.getElementById("frame-a");
  var frameB = document.getElementById("frame-b");
  var canvasA = document.getElementById("canvas-a");
  var canvasB = document.getElementById("canvas-b");
  var veilNode = document.getElementById("veil");
  var caption = document.getElementById("caption");
  var capTitle = document.getElementById("cap-title");
  var capMeta = document.getElementById("cap-meta");
  var live = document.getElementById("live");

  window.__zachtlicht = {
    index: 0,
    count: 0,
    ready: false,
    title: "",
    source: "",
    veil: veil
  };

  function publish() {
    var work = works[index] || {};
    window.__zachtlicht.index = index;
    window.__zachtlicht.count = works.length;
    window.__zachtlicht.ready = hasShown;
    window.__zachtlicht.title = work.title || "";
    window.__zachtlicht.source = work.source || "";
    window.__zachtlicht.veil = veil;
    window.__zachtlicht.captionOpacity = parseFloat(window.getComputedStyle(caption).opacity);
    window.__zachtlicht.showingA = showingA;
  }

  function getJson(target, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", target);
    xhr.timeout = 12000;
    xhr.onload = function () {
      if (xhr.status !== 200) {
        callback(new Error("HTTP " + xhr.status));
        return;
      }
      try {
        callback(null, JSON.parse(xhr.responseText));
      } catch (error) {
        callback(error);
      }
    };
    xhr.onerror = function () { callback(new Error("netwerk")); };
    xhr.ontimeout = function () { callback(new Error("timeout")); };
    xhr.send();
  }

  function pick(list, count) {
    var copy = list.slice();
    var out = [];
    var i;
    for (i = 0; i < count && copy.length; i += 1) {
      var at = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(at, 1)[0]);
    }
    return out;
  }

  function artwork(source, title, artist, year, image, credit) {
    if (!image || image.indexOf("https://") !== 0) {
      return null;
    }
    return {
      source: source,
      title: title || "Zonder titel",
      artist: artist || "",
      year: year || "",
      image: image,
      credit: credit
    };
  }

  function loadWorks(callback) {
    var found = [];
    getJson("https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&departmentId=11&limit=1&offset=0", function (err, probe) {
      var total = (!err && probe && probe.total) ? probe.total : 0;
      var maxOffset = Math.max(0, Math.min(total, 10000) - 6);
      var offset = Math.floor(Math.random() * (maxOffset + 1));
      getJson("https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&departmentId=11&limit=6&offset=" + offset, function (pageErr, data) {
      var ids = (!pageErr && data && data.objectIDs) ? data.objectIDs.slice(0, 4) : [];
      var left = ids.length;
      if (!left) {
        loadArtic(found, callback);
        return;
      }
      var i;
      for (i = 0; i < ids.length; i += 1) {
        getJson("https://collectionapi.metmuseum.org/public/collection/v1/objects/" + ids[i], function (objectErr, object) {
          if (!objectErr && object && object.isPublicDomain === true) {
            var image = object.primaryImageSmall || "";
            var made = artwork("met", object.title, object.artistDisplayName, object.objectDate, image, "Metropolitan Museum of Art");
            if (made) {
              found.push(made);
            }
          }
          left -= 1;
          if (left === 0) {
            loadArtic(found, callback);
          }
        });
      }
      });
    });
  }

  function loadArtic(found, callback) {
    var query = "https://api.artic.edu/api/v1/artworks/search?query%5Bterm%5D%5Bis_public_domain%5D=true&query%5Bterm%5D%5Bartwork_type_title%5D=Painting&fields=id,title,artist_display,image_id,date_display&limit=4&page=1";
    getJson(query, function (err, data) {
      var rows = (!err && data && data.data) ? data.data : [];
      var i;
      for (i = 0; i < rows.length; i += 1) {
        var row = rows[i];
        if (!row || !row.image_id) {
          continue;
        }
        var image = "https://www.artic.edu/iiif/2/" + row.image_id + "/full/" + imageSize + ",/0/default.jpg";
        var made = artwork("artic", row.title, row.artist_display, row.date_display, image, "Art Institute of Chicago");
        if (made) {
          found.push(made);
        }
      }
      callback(found);
    });
  }

  function drawSoft(canvas, img) {
    var nw = img.naturalWidth || img.width;
    var nh = img.naturalHeight || img.height;
    if (!nw || !nh) {
      return;
    }
    var w = nw > imageSize ? imageSize : nw;
    var h = Math.max(1, Math.round(nh * (w / nw)));
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) {
      ctx.imageSmoothingQuality = "high";
    }
    ctx.drawImage(img, 0, 0, w, h);
    var frame = canvas.parentNode;
    var frameW = frame.clientWidth || 1;
    var frameH = frame.clientHeight || 1;
    var ratio = w / h;
    var frameRatio = frameW / frameH;
    var dw;
    var dh;
    if (ratio > frameRatio) {
      dh = frameH;
      dw = frameH * ratio;
    } else {
      dw = frameW;
      dh = frameW / ratio;
    }
    canvas.style.width = Math.round(dw) + "px";
    canvas.style.height = Math.round(dh) + "px";
  }

  function loadImage(url, callback) {
    var img = new Image();
    img.onload = function () { callback(null, img); };
    img.onerror = function () { callback(new Error("beeld")); };
    img.src = url;
  }

  function setOpacity(layer, value, ms) {
    layer.style.transition = "opacity " + ms + "ms linear";
    layer.style.opacity = String(value);
  }

  function startDrift(frame, sign) {
    frame.style.transition = "none";
    frame.style.transform = "translate3d(0px, 0px, 0) scale(1)";
    frame.offsetHeight;
    frame.style.transition = "transform " + DURATION + "ms linear";
    frame.style.transform = "translate3d(" + (22 * sign) + "px, " + (-14 * sign) + "px, 0) scale(1.05)";
  }

  function showCaption(work) {
    capTitle.textContent = work.title || "Zonder titel";
    var meta = work.artist || "";
    if (work.year) {
      meta = meta ? meta + "  ·  " + work.year : work.year;
    }
    capMeta.textContent = meta;
    capMeta.style.display = meta ? "block" : "none";
    caption.style.transition = "none";
    caption.style.opacity = "0";
    caption.offsetHeight;
    caption.style.transition = "opacity 2.2s linear";
    caption.style.opacity = "0.7";
    window.setTimeout(function () {
      if (works[index] !== work) {
        return;
      }
      caption.style.opacity = "0";
    }, 6700);
  }

  function beginHold(which) {
    var frame = which === "a" ? frameA : frameB;
    var sign = ((index + pass) % 2 === 0) ? 1 : -1;
    startDrift(frame, sign);
    showCaption(works[index]);
    window.clearTimeout(holdTimer);
    holdTimer = window.setTimeout(requestNext, DURATION);
    publish();
    live.textContent = "Werk " + (index + 1) + " van " + works.length + ". Op de tv blijft een werk 90 seconden staan.";
  }

  function incoming(which, done) {
    var canvas = which === "a" ? canvasA : canvasB;
    var work = works[index];
    loadImage(work.image, function (err, img) {
      if (err) {
        misses += 1;
        if (misses > works.length) {
          live.textContent = "De beelden laden niet. Het scherm op de tv blijft dan donker.";
          return;
        }
        index = (index + 1) % works.length;
        incoming(which, done);
        return;
      }
      misses = 0;
      drawSoft(canvas, img);
      done();
    });
  }

  function requestNext() {
    if (works.length < 2) {
      pass += 1;
      beginHold(showingA ? "a" : "b");
      return;
    }
    index = (index + 1) % works.length;
    var which = showingA ? "b" : "a";
    var layer = which === "a" ? layerA : layerB;
    setOpacity(layer, 0, 0);
    incoming(which, function () {
      setOpacity(layerA, which === "a" ? 1 : 0, CROSSFADE);
      setOpacity(layerB, which === "b" ? 1 : 0, CROSSFADE);
      window.setTimeout(function () {
        showingA = which === "a";
        beginHold(which);
      }, CROSSFADE);
    });
  }

  function start() {
    if (!works.length) {
      live.textContent = "Geen werken opgehaald. Het scherm blijft donker.";
      return;
    }
    incoming("a", function () {
      hasShown = true;
      showingA = true;
      setOpacity(layerA, 1, 800);
      beginHold("a");
    });
  }

  var veilButtons = document.querySelectorAll("[data-veil]");
  var b;
  for (b = 0; b < veilButtons.length; b += 1) {
    veilButtons[b].addEventListener("click", function (event) {
      veil = Number(event.currentTarget.getAttribute("data-veil"));
      veilNode.style.opacity = String(veil);
      var i;
      for (i = 0; i < veilButtons.length; i += 1) {
        veilButtons[i].setAttribute("aria-checked", veilButtons[i] === event.currentTarget ? "true" : "false");
      }
      publish();
    });
  }

  window.setInterval(publish, 250);
  loadWorks(function (items) {
    works = items;
    publish();
    start();
  });
})();
