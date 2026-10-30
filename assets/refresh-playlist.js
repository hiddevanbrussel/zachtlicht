var fs = require("fs");
var http = require("http");
var https = require("https");
var path = require("path");
var url = require("url");
var model = require("./settings-model.js");

var PER_SOURCE_ONE = 24;
var PER_SOURCE_TWO = 15;
var PER_SOURCE_THREE = 10;

function queryString(params) {
  var parts = [];
  var key;
  for (key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key])));
    }
  }
  return parts.join("&");
}

function getJson(targetUrl, callback, limitBytes) {
  var redirects = 0;
  var limit = limitBytes || 2000000;
  var settled = false;

  function finish(err, value) {
    if (settled) {
      return;
    }
    settled = true;
    callback(err, value);
  }

  function once(currentUrl) {
    var parsed = url.parse(currentUrl);
    var lib = parsed.protocol === "http:" ? http : https;
    var ignoreError = false;

    var req = lib.get({
      hostname: parsed.hostname,
      path: parsed.path,
      port: parsed.port,
      agent: false,
      headers: {
        "User-Agent": "Zachtlicht/0.1 (webOS screensaver)",
        "Accept": "application/json"
      }
    }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        redirects += 1;
        if (redirects > 4) {
          finish(new Error("Te veel redirects"));
          return;
        }
        ignoreError = true;
        once(url.resolve(currentUrl, res.headers.location));
        return;
      }

      var body = "";
      var tooBig = false;
      res.setEncoding("utf8");
      res.on("data", function (chunk) {
        if (tooBig) {
          return;
        }
        body += chunk;
        if (body.length > limit) {
          tooBig = true;
          req.abort();
        }
      });
      res.on("end", function () {
        if (tooBig) {
          finish(new Error("Antwoord te groot"));
          return;
        }
        if (res.statusCode !== 200) {
          finish(new Error("HTTP " + res.statusCode));
          return;
        }
        try {
          finish(null, JSON.parse(body));
        } catch (error) {
          finish(error);
        }
      });
    });

    req.setTimeout(12000, function () {
      req.abort();
    });
    req.on("error", function (error) {
      if (ignoreError) {
        return;
      }
      finish(error);
    });
  }

  once(targetUrl);
}

function mapLimit(items, limit, worker, done) {
  var nextIndex = 0;
  var active = 0;
  var results = [];
  var finished = false;

  function pump() {
    if (finished) {
      return;
    }
    if (nextIndex >= items.length && active === 0) {
      finished = true;
      done(results);
      return;
    }
    while (active < limit && nextIndex < items.length) {
      var current = items[nextIndex];
      nextIndex += 1;
      active += 1;
      worker(current, function (value) {
        active -= 1;
        if (value) {
          results.push(value);
        }
        pump();
      });
    }
  }

  if (!items.length) {
    done([]);
    return;
  }
  pump();
}

function shuffle(list) {
  var copy = list.slice();
  var i;
  for (i = copy.length - 1; i > 0; i -= 1) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function clip(value, max) {
  var text = String(value || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  if (text.length <= max) {
    return text;
  }
  return text.substring(0, max - 1) + "…";
}

function artwork(source, title, artist, year, image, credit) {
  if (!image || image.indexOf("https://") !== 0) {
    return null;
  }
  return {
    source: source,
    title: clip(title, 160),
    artist: clip(artist, 120),
    year: clip(year, 48),
    image: image,
    credit: credit
  };
}

function metSearchUrl(limit, offset) {
  return "https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&departmentId=11&limit=" + limit + "&offset=" + offset;
}

function fetchMet(settings, per, callback) {
  getJson(metSearchUrl(1, 0), function (err, probe) {
    if (err || !probe || !probe.total) {
      callback(err || new Error("Metropolitan Museum gaf geen werken terug."));
      return;
    }
    var batch = Math.min(40, per + 8);
    var maxOffset = Math.max(0, Math.min(probe.total, 10000) - batch);
    var offset = Math.floor(Math.random() * (maxOffset + 1));
    getJson(metSearchUrl(batch, offset), function (pageErr, data) {
      if (pageErr || !data || !data.objectIDs || !data.objectIDs.length) {
        callback(pageErr || new Error("Metropolitan Museum gaf geen werken terug."));
        return;
      }
      mapLimit(data.objectIDs, 4, function (id, done) {
        if (!/^\d+$/.test(String(id))) {
          done(null);
          return;
        }
        getJson("https://collectionapi.metmuseum.org/public/collection/v1/objects/" + id, function (objectErr, object) {
          if (objectErr || !object || object.isPublicDomain !== true) {
            done(null);
            return;
          }
          var image = object.primaryImageSmall || "";
          if (!image && settings.imageSize === 960) {
            image = object.primaryImage || "";
          }
          done(artwork(
            "met",
            object.title,
            object.artistDisplayName,
            object.objectDate,
            image,
            "Metropolitan Museum of Art"
          ));
        }, 1500000);
      }, function (items) {
        callback(null, items.slice(0, per));
      });
    }, 2000000);
  }, 2000000);
}

function fetchArtic(settings, per, callback) {
  var probe = "https://api.artic.edu/api/v1/artworks/search?" + queryString({
    "query[term][is_public_domain]": "true",
    "query[term][artwork_type_title]": "Painting",
    "fields": "id",
    "limit": "1",
    "page": "1"
  });
  getJson(probe, function (err, data) {
    var pages = 1;
    if (!err && data && data.pagination && data.pagination.total) {
      pages = Math.max(1, Math.min(400, Math.ceil(data.pagination.total / per)));
    }
    var page = 1 + Math.floor(Math.random() * pages);
    var listUrl = "https://api.artic.edu/api/v1/artworks/search?" + queryString({
      "query[term][is_public_domain]": "true",
      "query[term][artwork_type_title]": "Painting",
      "fields": "id,title,artist_display,image_id,date_display",
      "limit": String(per),
      "page": String(page)
    });
    getJson(listUrl, function (listErr, list) {
      if (listErr || !list || !list.data) {
        callback(listErr || err || new Error("Art Institute of Chicago gaf geen werken terug."));
        return;
      }
      var items = [];
      var i;
      for (i = 0; i < list.data.length; i += 1) {
        var row = list.data[i];
        if (!row || !row.image_id || !/^[A-Za-z0-9_-]+$/.test(row.image_id)) {
          continue;
        }
        var image = "https://www.artic.edu/iiif/2/" + row.image_id + "/full/" + settings.imageSize + ",/0/default.jpg";
        var made = artwork(
          "artic",
          row.title,
          row.artist_display,
          row.date_display,
          image,
          "Art Institute of Chicago"
        );
        if (made) {
          items.push(made);
        }
      }
      callback(null, items);
    }, 4000000);
  }, 2000000);
}

function rijksUrl(key, page, per, type) {
  var params = {
    key: key,
    format: "json",
    imgonly: "true",
    ps: String(per),
    p: String(page)
  };
  if (type) {
    params.type = type;
  }
  return "https://www.rijksmuseum.nl/api/nl/collection?" + queryString(params);
}

function rijksItems(data) {
  var items = [];
  var rows = data && data.artObjects ? data.artObjects : [];
  var i;
  for (i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var image = row && row.webImage && row.webImage.url ? row.webImage.url : "";
    var made = artwork(
      "rijks",
      row ? row.title : "",
      row ? row.principalOrFirstMaker : "",
      "",
      image,
      "Rijksmuseum"
    );
    if (made) {
      items.push(made);
    }
  }
  return items;
}

function fetchRijks(settings, per, callback) {
  getJson(rijksUrl(settings.rijksKey, 1, 1, "schilderij"), function (err, probe) {
    var type = "schilderij";
    if (err || !probe || !probe.count) {
      type = "";
    }
    var count = probe && probe.count ? probe.count : per;
    var pages = Math.max(1, Math.min(40, Math.ceil(count / per)));
    var page = 1 + Math.floor(Math.random() * pages);
    getJson(rijksUrl(settings.rijksKey, page, per, type), function (pageErr, pageData) {
      var items = rijksItems(pageData);
      if (pageErr || !items.length) {
        getJson(rijksUrl(settings.rijksKey, 1, per, type), function (firstErr, firstData) {
          var firstItems = rijksItems(firstData);
          if (firstErr || !firstItems.length) {
            callback(firstErr || pageErr || err || new Error("Rijksmuseum gaf geen werken terug."));
            return;
          }
          callback(null, firstItems);
        }, 4000000);
        return;
      }
      callback(null, items);
    }, 4000000);
  }, 2000000);
}

function writePlaylist(items) {
  var dir = model.dataDir();
  var file = path.join(dir, "playlist.json");
  if (!items.length) {
    if (fs.existsSync(file)) {
      console.error("Geen nieuwe werken. De bestaande lijst blijft staan.");
      process.exit(0);
    }
    console.error("Geen werken opgehaald.");
    process.exit(1);
  }
  model.mkdirp(dir);
  var payload = {
    fetchedAt: new Date().toISOString(),
    items: shuffle(items)
  };
  var tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload));
  fs.renameSync(tmp, file);
  console.log(payload.items.length + " werken opgeslagen.");
  process.exit(0);
}

function main() {
  var settings = model.read();
  var jobs = [];
  if (settings.met) {
    jobs.push(fetchMet);
  }
  if (settings.artic) {
    jobs.push(fetchArtic);
  }
  if (settings.rijks && settings.rijksKey) {
    jobs.push(fetchRijks);
  }
  if (!jobs.length) {
    console.error("Geen bron aan.");
    process.exit(1);
  }

  var per = PER_SOURCE_THREE;
  if (jobs.length === 1) {
    per = PER_SOURCE_ONE;
  } else if (jobs.length === 2) {
    per = PER_SOURCE_TWO;
  }

  var collected = [];
  var pending = jobs.length;
  var closed = false;

  function closeWith() {
    if (closed) {
      return;
    }
    closed = true;
    writePlaylist(collected);
  }

  var i;
  for (i = 0; i < jobs.length; i += 1) {
    jobs[i](settings, per, function (err, items) {
      if (closed) {
        return;
      }
      if (err) {
        console.error(err.message || String(err));
      }
      if (items && items.length) {
        collected = collected.concat(items);
      }
      pending -= 1;
      if (pending === 0) {
        closeWith();
      }
    });
  }

  setTimeout(closeWith, 75000);
}

main();
