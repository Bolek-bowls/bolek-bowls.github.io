/*
  Рисует страницы из данных в data/bowls.js.
  Страница боула: <body data-page="bowl" data-bowl="shrimp">
  Главная:        <body data-page="home">
*/
(function () {
  "use strict";

  var BOWLS = window.BOLEK_BOWLS || [];
  var app = document.getElementById("app");

  /* ---------- Иконки (тонкие линии) ---------- */
  var ICON = {
    left:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    copy:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>',
    bowl:  '<svg viewBox="0 0 120 100" fill="none" stroke="#FF3802" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 52h92a46 38 0 0 1-92 0z"/><path d="M38 52c0-9 10-14 22-14s22 5 22 14"/><path d="M70 6l-18 32M80 10L62 40"/></svg>'
  };

  /* ---------- Расчёты ---------- */
  function round(n, d) { var k = Math.pow(10, d); return Math.round(n * k) / k; }
  function fmt(n, d) { return round(n, d).toFixed(d).replace(".", ","); }          // 18.25 -> "18,3"
  function fmtRow(n) { return String(round(n, 2)).replace(".", ","); }              // 0.45 -> "0,45", 50 -> "50"
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }

  function totals(b) {
    var t = { g: 0, kcal: 0, p: 0, f: 0, c: 0 };
    b.ingredients.forEach(function (i) {
      t.g += i.g; t.kcal += i.kcal; t.p += i.p; t.f += i.f; t.c += i.c;
    });
    Object.keys(t).forEach(function (k) { t[k] = round(t[k], 2); }); // убираем хвосты вида 18.250000000004
    return t;
  }

  // Доля калорий из белков/жиров/углеводов (4, 9 и 4 ккал на грамм), в целых процентах, в сумме 100
  function shares(t) {
    var raw = [t.p * 4, t.f * 9, t.c * 4];
    var sum = raw[0] + raw[1] + raw[2];
    var pct = raw.map(function (v) { return v / sum * 100; });
    var out = pct.map(Math.floor);
    var left = 100 - out.reduce(function (a, b) { return a + b; }, 0);
    pct.map(function (v, i) { return [v - out[i], i]; })
       .sort(function (a, b) { return b[0] - a[0]; })
       .slice(0, left).forEach(function (x) { out[x[1]] += 1; });
    return out;
  }

  function view(t, mode) {
    var k = mode === "100" ? 100 / t.g : 1;
    return { kcal: t.kcal * k, p: t.p * k, f: t.f * k, c: t.c * k };
  }

  function bowlBySlug(slug) {
    return BOWLS.filter(function (b) { return b.slug === slug; })[0];
  }

  /* ---------- Кусочки разметки ---------- */
  function photoBlock(b, cls) {
    // Пока файла с фото нет, блок скрыт и места не занимает
    return '<div class="' + cls + '" hidden data-photo="' + esc(b.photo || "") + '"></div>';
  }

  // Пытаемся загрузить фото; если файла нет, остаётся заглушка
  function attachPhotos(root) {
    root.querySelectorAll("[data-photo]").forEach(function (box) {
      var src = box.getAttribute("data-photo");
      if (!src) return;
      var img = new Image();
      img.alt = "";
      img.onload = function () {
        box.appendChild(img);
        box.hidden = false;
        var host = box.closest(".layout, .card");
        if (host) host.classList.add("has-photo");
      };
      img.src = src;
    });
  }

  function cardHtml(b) {
    var t = totals(b);
    return '<a class="card" href="' + esc(b.slug) + '.html">' +
      photoBlock(b, "thumb") +
      '<div class="row"><div class="txt"><h3>' + esc(b.name) + '</h3>' +
      '<p class="meta">' + fmt(t.kcal, 0) + ' ккал · ' + fmt(t.g, 0) + ' г</p>' +
      '<p class="meta">Б&nbsp;' + fmt(t.p, 1) + ' · Ж&nbsp;' + fmt(t.f, 1) + ' · У&nbsp;' + fmt(t.c, 1) + '</p></div>' +
      '<span class="go">' + ICON.right + '</span></div></a>';
  }

  /* ---------- Главная ---------- */
  function renderHome() {
    app.innerHTML =
      '<div class="wrap home-body"><p class="eyebrow">Выберите боул</p>' +
      '<div class="cards">' + BOWLS.map(cardHtml).join("") + '</div></div>';
    attachPhotos(app);
  }

  /* ---------- Страница боула ---------- */
  function renderBowl(b) {
    var t = totals(b);
    var sh = shares(t);
    var sep = b.ingredients.filter(function (i) { return i.separate; })[0];
    var other = BOWLS.filter(function (x) { return x.slug !== b.slug; });

    var rows = b.ingredients.map(function (i) {
      return '<tr><td>' + esc(i.name) + (i.separate ? '<span class="tag">отдельно</span>' : '') +
        '<span class="grams">' + fmtRow(i.g) + ' г</span></td>' +
        '<td>' + fmtRow(i.kcal) + '</td><td>' + fmtRow(i.p) + '</td><td>' + fmtRow(i.f) + '</td><td>' + fmtRow(i.c) + '</td></tr>';
    }).join("");

    app.innerHTML =
      '<div class="wrap">' +
        '<section class="intro">' +
          '<p class="eyebrow"><span>Здоровое меню</span><span>Боул</span></p>' +
          '<h1>' + esc(b.name) + '</h1>' +
          '<p class="portion">Порция <b>' + fmt(t.g, 0) + ' г</b>' +
            (sep ? '. ' + esc(sep.name) + ' подаётся отдельно, он уже входит в значения ниже' : '') + '</p>' +
        '</section>' +

        '<div class="layout">' +
          '<div class="col-main">' +
            '<div class="seg" role="group" aria-label="Показать значения">' +
              '<button type="button" data-mode="portion" aria-pressed="true">На порцию</button>' +
              '<button type="button" data-mode="100" aria-pressed="false">На 100 г</button>' +
            '</div>' +
            '<div class="facts" aria-live="polite">' +
              '<div class="fact fact--kcal"><span class="label">Калории</span><span class="value"><span data-v="kcal"></span><small>ккал</small></span></div>' +
              '<div class="fact fact--p"><span class="label">Белки</span><span class="value"><span data-v="p"></span><small>г</small></span></div>' +
              '<div class="fact fact--f"><span class="label">Жиры</span><span class="value"><span data-v="f"></span><small>г</small></span></div>' +
              '<div class="fact fact--c"><span class="label">Углеводы</span><span class="value"><span data-v="c"></span><small>г</small></span></div>' +
            '</div>' +
            '<div class="split"><p class="eyebrow">Откуда калории</p>' +
              '<div class="bar" role="img" aria-label="Белки ' + sh[0] + '%, жиры ' + sh[1] + '%, углеводы ' + sh[2] + '%">' +
                '<i class="s-p" style="width:' + sh[0] + '%"></i><i class="s-f" style="width:' + sh[1] + '%"></i><i class="s-c" style="width:' + sh[2] + '%"></i></div>' +
              '<div class="legend"><span><i class="s-p"></i>Белки ' + sh[0] + '%</span><span><i class="s-f"></i>Жиры ' + sh[1] + '%</span><span><i class="s-c"></i>Углеводы ' + sh[2] + '%</span></div>' +
            '</div>' +
            '<div class="actions"><button type="button" class="btn" id="copy">' + ICON.copy + 'Скопировать КБЖУ</button></div>' +
          '</div>' +
          photoBlock(b, "photo") +
        '</div>' +

        '<section class="section">' +
          '<div class="section-head"><h2>Состав</h2><span class="eyebrow">на одну порцию</span></div>' +
          '<table><thead><tr><th>Ингредиент</th><th>Ккал</th><th>Б</th><th>Ж</th><th>У</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
          '<tfoot><tr><td>Итого<span class="grams">' + fmt(t.g, 0) + ' г</span></td>' +
            '<td>' + fmt(t.kcal, 0) + '</td><td>' + fmt(t.p, 1) + '</td><td>' + fmt(t.f, 1) + '</td><td>' + fmt(t.c, 1) + '</td></tr></tfoot></table>' +
        '</section>' +
      '</div>';

    /* значения в плитках */
    var mode = "portion";
    function paint() {
      var v = view(t, mode);
      app.querySelector('[data-v="kcal"]').textContent = fmt(v.kcal, 0);
      app.querySelector('[data-v="p"]').textContent = fmt(v.p, 1);
      app.querySelector('[data-v="f"]').textContent = fmt(v.f, 1);
      app.querySelector('[data-v="c"]').textContent = fmt(v.c, 1);
    }
    paint();

    app.querySelectorAll(".seg button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        mode = btn.getAttribute("data-mode");
        app.querySelectorAll(".seg button").forEach(function (x) {
          x.setAttribute("aria-pressed", x === btn ? "true" : "false");
        });
        paint();
      });
    });

    /* копирование */
    document.getElementById("copy").addEventListener("click", function () {
      var v = view(t, mode);
      var text = b.name + (mode === "100" ? " (на 100 г)" : " (порция " + fmt(t.g, 0) + " г)") + "\n" +
        "Калории: " + fmt(v.kcal, 0) + " ккал\n" +
        "Белки: " + fmt(v.p, 1) + " г\n" +
        "Жиры: " + fmt(v.f, 1) + " г\n" +
        "Углеводы: " + fmt(v.c, 1) + " г\n" +
        "bólek coffee station";
      copyText(text).then(function () { toast("КБЖУ скопированы"); },
                          function () { toast("Не удалось скопировать"); });
    });

    attachPhotos(app);
  }

  /* ---------- Копирование и уведомление ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {      // запасной вариант (например, при открытии файла с диска)
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }

  var toastTimer;
  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  /* ---------- Запуск ---------- */
  var page = document.body.getAttribute("data-page");
  if (!app) return;
  if (page === "home") {
    renderHome();
  } else {
    var b = bowlBySlug(document.body.getAttribute("data-bowl"));
    if (b) renderBowl(b);
    else app.innerHTML = '<div class="wrap"><p class="intro">Блюдо не найдено.</p></div>';
  }
})();
