var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

function crc32(buf) {
  var table = crc32.table;
  if (!table) {
    table = [];
    var n;
    for (n = 0; n < 256; n += 1) {
      var c = n;
      var k;
      for (k = 0; k < 8; k += 1) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table.push(c >>> 0);
    }
    crc32.table = table;
  }
  var crc = 0xffffffff;
  var i;
  for (i = 0; i < buf.length; i += 1) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  var length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  var typeBuf = Buffer.from(type, "ascii");
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function png(size) {
  var rowBytes = size * 4 + 1;
  var raw = Buffer.alloc(rowBytes * size);
  var y;
  for (y = 0; y < size; y += 1) {
    var o = y * rowBytes;
    raw[o] = 0;
    var x;
    for (x = 0; x < size; x += 1) {
      var dx = x + 0.5 - size / 2;
      var dy = y + 0.5 - size / 2;
      var d = Math.sqrt(dx * dx + dy * dy) / (size * 0.33);
      var t = Math.max(0, Math.min(1, 1 - d));
      t = t * t * (3 - 2 * t);
      var i = o + 1 + x * 4;
      raw[i] = Math.round(20 + (215 - 20) * t);
      raw[i + 1] = Math.round(18 + (196 - 18) * t);
      raw[i + 2] = Math.round(15 + (163 - 15) * t);
      raw[i + 3] = 255;
    }
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

var root = path.join(__dirname, "..");
fs.writeFileSync(path.join(root, "icon.png"), png(80));
fs.writeFileSync(path.join(root, "largeIcon.png"), png(130));
