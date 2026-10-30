'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var crypto = require('crypto');

var packedAt = Math.floor(Date.now() / 1000);
if (packedAt < 1700000000) throw new Error('Pakket-tijdstip is te oud voor de tv.');

var root = path.resolve(__dirname, '..');
var appinfo = JSON.parse(fs.readFileSync(path.join(root, 'appinfo.json'), 'utf8'));
var appPrefix = 'usr/palm/applications/' + appinfo.id;
var skipDirs = { '.git': true, node_modules: true, dist: true, tools: true };
var skipFiles = {
  '.gitignore': true,
  '.gitattributes': true,
  'repo.json': true,
  'README.md': true
};

function padOctal(text, size) {
  var body = text.length === size - 1
    ? text
    : new Array(size - text.length - 1).join('0') + text + ' ';
  return body + '\0';
}

function writeNumber(header, offset, size, value) {
  header.write(padOctal(Math.floor(value).toString(8), size), offset, size, 'ascii');
}

function tarHeader(name, size, mode, type) {
  if (Buffer.byteLength(name) > 100) {
    throw new Error('Pad te lang voor ustar: ' + name);
  }
  var header = Buffer.alloc(512, 0);
  header.write(name, 0, 'utf8');
  writeNumber(header, 100, 8, mode);
  writeNumber(header, 108, 8, 0);
  writeNumber(header, 116, 8, 0);
  writeNumber(header, 124, 12, size);
  writeNumber(header, 136, 12, packedAt);
  header[156] = type.charCodeAt(0);
  header.write('ustar\0', 257, 'ascii');
  header.write('00', 263, 'ascii');
  writeNumber(header, 329, 8, 0);
  writeNumber(header, 337, 8, 0);
  var sum = 8 * 0x20;
  var i;
  for (i = 0; i < 148; i++) sum += header[i];
  for (i = 156; i < 512; i++) sum += header[i];
  writeNumber(header, 148, 8, sum);
  return header;
}

function collect(dir, prefix, entries) {
  var names = fs.readdirSync(dir).sort();
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    if (prefix === '' && (skipDirs[name] || skipFiles[name])) continue;
    var full = path.join(dir, name);
    var rel = prefix ? prefix + '/' + name : name;
    var stat = fs.statSync(full);
    if (stat.isDirectory()) {
      entries.push({ name: appPrefix + '/' + rel + '/', mode: 0o755, type: '5', body: Buffer.alloc(0) });
      collect(full, rel, entries);
    } else if (stat.isFile()) {
      var mode = name.slice(-3) === '.sh' ? 0o755 : 0o644;
      entries.push({ name: appPrefix + '/' + rel, mode: mode, type: '0', body: fs.readFileSync(full) });
    }
  }
}

function buildTar(entries) {
  var parts = [];
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    parts.push(tarHeader(entry.name, entry.body.length, entry.mode, entry.type));
    parts.push(entry.body);
    var pad = (512 - (entry.body.length % 512)) % 512;
    if (pad) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(1024, 0));
  return Buffer.concat(parts);
}

function padSpace(input, length) {
  return String(input + '                                     ').slice(0, length);
}

function arMember(name, body) {
  var header = padSpace(name, 16) +
    padSpace(packedAt, 12) +
    '0     ' +
    '0     ' +
    '100644  ' +
    padSpace(body.length, 10) +
    '`\n';
  var chunks = [Buffer.from(header, 'ascii'), body];
  if (body.length % 2 === 1) chunks.push(Buffer.from('\n'));
  return Buffer.concat(chunks);
}

var dataEntries = [
  { name: 'usr/', mode: 0o755, type: '5', body: Buffer.alloc(0) },
  { name: 'usr/palm/', mode: 0o755, type: '5', body: Buffer.alloc(0) },
  { name: 'usr/palm/applications/', mode: 0o755, type: '5', body: Buffer.alloc(0) },
  { name: appPrefix + '/', mode: 0o755, type: '5', body: Buffer.alloc(0) }
];
collect(root, '', dataEntries);

var installedSize = 0;
for (var n = 0; n < dataEntries.length; n++) installedSize += dataEntries[n].body.length;

var control = [
  'Package: ' + appinfo.id,
  'Version: ' + appinfo.version,
  'Section: misc',
  'Priority: optional',
  'Architecture: all',
  'Installed-Size: ' + installedSize,
  'Maintainer: ' + appinfo.vendor + ' <nobody@example.com>',
  'Description: ' + appinfo.appDescription,
  'webOS-Package-Format-Version: 2',
  'webOS-Packager-Version: x.y.x',
  ''
].join('\n');

var dataTar = zlib.gzipSync(buildTar(dataEntries));
var controlTar = zlib.gzipSync(buildTar([
  { name: 'control', mode: 0o644, type: '0', body: Buffer.from(control, 'utf8') }
]));
var ipk = Buffer.concat([
  Buffer.from('!<arch>\n', 'ascii'),
  arMember('debian-binary', Buffer.from('2.0\n', 'ascii')),
  arMember('control.tar.gz', controlTar),
  arMember('data.tar.gz', dataTar)
]);

var ipkName = appinfo.id + '_' + appinfo.version + '_all.ipk';
var outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
var ipkPath = path.join(outDir, ipkName);
fs.writeFileSync(ipkPath, ipk);

var sha256 = crypto.createHash('sha256').update(ipk).digest('hex');
var manifest = {
  id: appinfo.id,
  version: appinfo.version,
  type: 'web',
  title: appinfo.title,
  appDescription: appinfo.appDescription,
  iconUri: 'https://raw.githubusercontent.com/hiddevanbrussel/zachtlicht/main/largeIcon.png',
  sourceUrl: 'https://github.com/hiddevanbrussel/zachtlicht',
  rootRequired: true,
  ipkUrl: 'https://github.com/hiddevanbrussel/zachtlicht/releases/download/v' + appinfo.version + '/' + ipkName,
  ipkHash: { sha256: sha256 }
};
fs.writeFileSync(path.join(outDir, appinfo.id + '.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

function readTar(gzipped) {
  var tar = zlib.gunzipSync(gzipped);
  var found = [];
  var offset = 0;
  while (offset + 512 <= tar.length) {
    var header = tar.subarray(offset, offset + 512);
    if (header.every(function (byte) { return byte === 0; })) break;
    var name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
    var sizeText = header.toString('ascii', 124, 136).replace(/\0.*$/, '').trim();
    var size = parseInt(sizeText, 8);
    var mtime = parseInt(header.toString('ascii', 136, 148).replace(/\0.*$/, '').trim(), 8);
    if (mtime < 1700000000) throw new Error('Tijdstip in ' + name + ' is te oud voor de tv.');
    var modeText = header.toString('ascii', 100, 108);
    if (!/^[0-7 ]+\0/.test(modeText)) throw new Error('Ongeldig tar-modusveld voor ' + name);
    found.push(name);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return found;
}

var members = [];
var cursor = 8;
while (cursor + 60 <= ipk.length) {
  var memberName = ipk.toString('ascii', cursor, cursor + 16).replace(/\s+.*/, '');
  var memberSize = parseInt(ipk.toString('ascii', cursor + 48, cursor + 58).trim(), 10);
  var memberBody = ipk.subarray(cursor + 60, cursor + 60 + memberSize);
  members.push(memberName);
  if (memberName === 'debian-binary' && memberBody.toString('ascii') !== '2.0\n') {
    throw new Error('debian-binary is niet 2.0');
  }
  if (memberName === 'control.tar.gz') readTar(memberBody);
  if (memberName === 'data.tar.gz') {
    var packed = readTar(memberBody);
    var appinfoPath = appPrefix + '/appinfo.json';
    var qmlPath = appPrefix + '/assets/screensaver-main.qml';
    if (packed.indexOf(appinfoPath) === -1) throw new Error('appinfo.json ontbreekt in het pakket');
    if (packed.indexOf(qmlPath) === -1) throw new Error('screensaver-main.qml ontbreekt in het pakket');
  }
  cursor += 60 + memberSize + (memberSize % 2);
}

if (members.join(',') !== 'debian-binary,control.tar.gz,data.tar.gz') {
  throw new Error('Onverwachte ipk-leden: ' + members.join(','));
}

process.stdout.write(ipkPath + '\n' + sha256 + '\n' + String(ipk.length) + '\n');
process.exit(0);
