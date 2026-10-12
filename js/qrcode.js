/* Мини-генератор QR-кодов (байтовый режим, коррекция ошибок M, версии 1-10).
   Использование: var m = BolekQR.encode("https://..."); m.size, m.get(x, y) */
var BolekQR = (function () {
  "use strict";
  var ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];  // кодовых слов коррекции на блок, уровень M
  var BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];            // число блоков, уровень M

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCap(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v]; }

  // Арифметика Рида-Соломона в поле GF(256)
  function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function rsDiv(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (var i = 0; i < deg; i++) {
      for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = mul(root, 2);
    }
    return r;
  }
  function rsRem(data, div) {
    var res = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ res.shift(); res.push(0);
      div.forEach(function (c, i) { res[i] ^= mul(c, f); });
    });
    return res;
  }

  function encode(text) {
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(text));
    var ver = 1;
    while (ver <= 10 && (4 + (ver < 10 ? 8 : 16) + bytes.length * 8) > dataCap(ver) * 8) ver++;
    if (ver > 10) throw new Error("Адрес слишком длинный для QR");

    // биты данных
    var bits = [];
    function put(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var capBits = dataCap(ver) * 8;
    put(0, Math.min(4, capBits - bits.length));
    while (bits.length % 8) bits.push(0);
    for (var pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var v = 0; for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }

    // блоки + коррекция
    var nb = BLK[ver], ec = ECC[ver], raw = Math.floor(rawModules(ver) / 8);
    var shortN = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var div = rsDiv(ec), blocks = [], k = 0;
    for (var i = 0; i < nb; i++) {
      var len = shortLen - ec + (i < shortN ? 0 : 1);
      var d = data.slice(k, k + len); k += len;
      var e = rsRem(d, div);
      if (i < shortN) d.push(0);
      blocks.push(d.concat(e));
    }
    var all = [];
    for (var i = 0; i < blocks[0].length; i++)
      blocks.forEach(function (b, j) { if (i !== shortLen - ec || j >= shortN) all.push(b[i]); });

    // матрица
    var size = ver * 4 + 17, m = [], fn = [];
    for (var y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setF(x, y, dark) { m[y][x] = dark; fn[y][x] = true; }
    for (var i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue;
        var dist = Math.max(Math.abs(dx), Math.abs(dy)); setF(x, y, dist !== 2 && dist !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var pos = [];
    if (ver > 1) {
      var n = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      pos = [6]; for (var p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    }
    pos.forEach(function (ax, i) { pos.forEach(function (ay, j) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    function drawFormat(mask) {
      var d = (0 << 3) | mask, r = d;                    // уровень M = 0
      for (var i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var b = ((d << 10) | r) ^ 0x5412;
      function bit(i) { return ((b >>> i) & 1) !== 0; }
      for (var i = 0; i <= 5; i++) setF(8, i, bit(i));
      setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for (var i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
      for (var i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i));
      for (var i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
      setF(8, size - 8, true);
    }
    drawFormat(0);
    if (ver >= 7) {
      var r = ver; for (var i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      var vb = (ver << 12) | r;
      for (var i = 0; i < 18; i++) { var c = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, b2 = Math.floor(i / 3); setF(a, b2, c); setF(b2, a, c); }
    }
    // данные зигзагом
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && idx < all.length * 8) { m[y][x] = ((all[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0; idx++; }
      }
    }
    // маска: выбираем с наименьшим штрафом
    function applyMask(mask) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var inv; switch (mask) {
          case 0: inv = (x + y) % 2 === 0; break; case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break; case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = x * y % 2 + x * y % 3 === 0; break; case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (!fn[y][x] && inv) m[y][x] = !m[y][x];
      }
    }
    function penalty() {
      var p = 0, dark = 0;
      for (var pass = 0; pass < 2; pass++) for (var a = 0; a < size; a++) {
        var run = 1, hist = [];
        for (var b = 0; b < size; b++) {
          var c = pass ? m[b][a] : m[a][b];
          if (b > 0 && c === (pass ? m[b - 1][a] : m[a][b - 1])) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
          hist.push(c ? 1 : 0);
        }
        var s = hist.join("");
        var f = s.match(/10111010000|00001011101/g); if (f) p += 40 * f.length;
      }
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        if (m[y][x]) dark++;
        if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
      }
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      applyMask(mask); drawFormat(mask);
      var pe = penalty(); if (pe < bestP) { bestP = pe; best = mask; }
      applyMask(mask);                                   // снимаем маску
    }
    applyMask(best); drawFormat(best);
    return { size: size, get: function (x, y) { return m[y][x]; } };
  }
  return { encode: encode };
})();
