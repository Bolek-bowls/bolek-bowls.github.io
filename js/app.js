/*
  Рисует страницы из данных в data/bowls.js.
  Страница блюда: <body data-page="bowl" data-bowl="shrimp">  (так же для сэндвичей: data-bowl="sandwich-beef")
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

  /* Состояние переключателей страницы: sauce (отдельный соус), on (необязательные ингредиенты), v (выбранный вариант) */
  function initState(b) {
    var st = { sauce: true, on: {}, v: {} };
    b.ingredients.forEach(function (i, k) {
      if (i.optional) st.on[k] = !!i.on;
      if (i.variants) st.v[k] = 0;
    });
    return st;
  }
  function nutr(i, k, st) { return i.variants ? i.variants[st.v[k] || 0] : i; }   // значения с учётом выбранного варианта
  function isOff(i, k, st) { return (i.separate && !st.sauce) || (i.optional && !st.on[k]); }

  function totals(b, st) {
    st = st || initState(b);
    var t = { g: 0, kcal: 0, p: 0, f: 0, c: 0 };
    b.ingredients.forEach(function (i, k) {
      if (isOff(i, k, st)) return;
      var n = nutr(i, k, st);
      t.g += i.g; t.kcal += n.kcal; t.p += n.p; t.f += n.f; t.c += n.c;
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
    var groups = [];
    BOWLS.forEach(function (b) {
      var name = b.group || "Меню";
      var g = groups.filter(function (x) { return x.name === name; })[0];
      if (!g) { g = { name: name, items: [] }; groups.push(g); }
      g.items.push(b);
    });
    app.innerHTML = '<div class="wrap home-body">' + groups.map(function (g) {
      return '<p class="eyebrow">' + esc(g.name) + '</p><div class="cards">' + g.items.map(cardHtml).join("") + '</div>';
    }).join("") + '</div>';
    attachPhotos(app);
  }

  /* ---------- Страница блюда ---------- */
  function renderBowl(b) {
    var sep = b.ingredients.filter(function (i) { return i.separate; })[0];
    var st = initState(b);
    var t;

    // Переключатели: отдельный соус, варианты (молоко), необязательные добавки (лёд, сироп)
    var ctls = [];
    b.ingredients.forEach(function (i, k) {
      if (i.separate) {
        ctls.push({ kind: "sauce", k: k, label: i.name, opts: [["1", "С соусом"], ["0", "Без соуса"]], cur: st.sauce ? "1" : "0" });
      } else if (i.variants) {
        ctls.push({ kind: "var", k: k, label: i.name, opts: i.variants.map(function (v, n) { return [String(n), v.short || v.name]; }), cur: "0" });
      } else if (i.optional) {
        ctls.push({ kind: "opt", k: k, label: i.name, opts: [["1", i.yes || "Да"], ["0", i.no || "Нет"]], cur: st.on[k] ? "1" : "0" });
      }
    });
    var ctlHtml = ctls.map(function (c) {
      return '<div class="ctl"><span class="eyebrow">' + esc(c.label) + '</span>' +
        '<div class="seg' + (c.opts.length > 2 ? ' many' : '') + '" data-kind="' + c.kind + '" data-k="' + c.k + '" role="group" aria-label="' + esc(c.label) + '">' +
        c.opts.map(function (o) {
          return '<button type="button" data-val="' + o[0] + '" aria-pressed="' + (o[0] === c.cur ? "true" : "false") + '">' + esc(o[1]) + '</button>';
        }).join("") + '</div></div>';
    }).join("");

    function rowsHtml() {
      return b.ingredients.map(function (i, k) {
        var n = nutr(i, k, st);
        var name = i.variants ? i.name + ": " + n.name.toLowerCase() : i.name;
        var tag = i.separate ? "отдельно" : (i.optional ? "по желанию" : "");
        return '<tr' + (isOff(i, k, st) ? ' class="off"' : '') + '><td>' + esc(name) + (tag ? '<span class="tag">' + tag + '</span>' : '') +
          '<span class="grams">' + fmtRow(i.g) + ' ' + (i.u || "г") + '</span></td>' +
          '<td>' + fmtRow(n.kcal) + '</td><td>' + fmtRow(n.p) + '</td><td>' + fmtRow(n.f) + '</td><td>' + fmtRow(n.c) + '</td></tr>';
      }).join("");
    }

    app.innerHTML =
      '<div class="wrap">' +
        '<section class="intro">' +
          '<p class="eyebrow"><span>Здоровое меню</span><span>' + esc(b.kind || "Боул") + '</span></p>' +
          '<h1>' + esc(b.name) + '</h1>' +
          (b.when ? '<p class="portion">' + esc(b.when) + '</p>' : '') +
          '<p class="portion" id="portion"></p>' +
        '</section>' +

        '<div class="layout">' +
          '<div class="col-main">' +
            '<div class="controls">' +
              '<div class="seg" id="seg-mode" role="group" aria-label="Показать значения">' +
                '<button type="button" data-mode="portion" aria-pressed="true">На порцию</button>' +
                '<button type="button" data-mode="100" aria-pressed="false">На 100 г</button>' +
              '</div>' +
              ctlHtml +
            '</div>' +
            '<div class="facts" aria-live="polite">' +
              '<div class="fact fact--kcal"><span class="label">Калории</span><span class="value"><span data-v="kcal"></span><small>ккал</small></span></div>' +
              '<div class="fact fact--p"><span class="label">Белки</span><span class="value"><span data-v="p"></span><small>г</small></span></div>' +
              '<div class="fact fact--f"><span class="label">Жиры</span><span class="value"><span data-v="f"></span><small>г</small></span></div>' +
              '<div class="fact fact--c"><span class="label">Углеводы</span><span class="value"><span data-v="c"></span><small>г</small></span></div>' +
            '</div>' +
            '<div class="split"><p class="eyebrow">Откуда калории</p>' +
              '<div class="bar" id="bar" role="img"><i class="s-p"></i><i class="s-f"></i><i class="s-c"></i></div>' +
              '<div class="legend" id="legend"></div>' +
            '</div>' +
            '<div class="actions"><button type="button" class="btn" id="copy">' + ICON.copy + 'Скопировать КБЖУ</button></div>' +
          '</div>' +
          photoBlock(b, "photo") +
        '</div>' +

        '<section class="section">' +
          '<div class="section-head"><h2>Состав</h2><span class="eyebrow">на одну порцию</span></div>' +
          '<table><thead><tr><th>Ингредиент</th><th>Ккал</th><th>Б</th><th>Ж</th><th>У</th></tr></thead>' +
          '<tbody id="tbody"></tbody>' +
          '<tfoot><tr id="total-row"></tr></tfoot></table>' +
        '</section>' +
      '</div>';

    var mode = "portion";

    function paint() {
      t = totals(b, st);
      var v = view(t, mode);
      app.querySelector('[data-v="kcal"]').textContent = fmt(v.kcal, 0);
      app.querySelector('[data-v="p"]').textContent = fmt(v.p, 1);
      app.querySelector('[data-v="f"]').textContent = fmt(v.f, 1);
      app.querySelector('[data-v="c"]').textContent = fmt(v.c, 1);

      var sh = shares(t);
      var bar = document.getElementById("bar");
      bar.setAttribute("aria-label", "Белки " + sh[0] + "%, жиры " + sh[1] + "%, углеводы " + sh[2] + "%");
      var seg = bar.children;
      seg[0].style.width = sh[0] + "%"; seg[1].style.width = sh[1] + "%"; seg[2].style.width = sh[2] + "%";
      document.getElementById("legend").innerHTML =
        '<span><i class="s-p"></i>Белки ' + sh[0] + '%</span><span><i class="s-f"></i>Жиры ' + sh[1] + '%</span><span><i class="s-c"></i>Углеводы ' + sh[2] + '%</span>';

      document.getElementById("portion").innerHTML = 'Порция <b>' + fmt(t.g, 0) + ' г</b>' +
        (sep ? (st.sauce ? '. ' + esc(sep.name) + ' подаётся отдельно, он уже входит в значения ниже'
                         : '. Значения указаны без соуса') : '');

      document.getElementById("tbody").innerHTML = rowsHtml();
      document.getElementById("total-row").innerHTML = '<td>Итого<span class="grams">' + fmt(t.g, 0) + ' г</span></td>' +
        '<td>' + fmt(t.kcal, 0) + '</td><td>' + fmt(t.p, 1) + '</td><td>' + fmt(t.f, 1) + '</td><td>' + fmt(t.c, 1) + '</td>';
    }
    paint();

    function pick(box, onPick) {
      box.querySelectorAll("button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          box.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === btn ? "true" : "false"); });
          onPick(btn);
          paint();
        });
      });
    }
    pick(document.getElementById("seg-mode"), function (btn) { mode = btn.getAttribute("data-mode"); });
    app.querySelectorAll(".seg[data-kind]").forEach(function (box) {
      var kind = box.getAttribute("data-kind"), k = +box.getAttribute("data-k");
      pick(box, function (btn) {
        var val = btn.getAttribute("data-val");
        if (kind === "sauce") st.sauce = val === "1";
        else if (kind === "opt") st.on[k] = val === "1";
        else st.v[k] = +val;
      });
    });

    /* копирование */
    document.getElementById("copy").addEventListener("click", function () {
      var v = view(t, mode);
      var picks = [];
      b.ingredients.forEach(function (i, k) {
        if (i.separate) picks.push(i.name + ": " + (st.sauce ? "включён" : "без него"));
        else if (i.variants) picks.push(i.name + ": " + i.variants[st.v[k] || 0].name.toLowerCase());
        else if (i.optional) picks.push(i.name + ": " + (st.on[k] ? (i.yes || "да").toLowerCase() : (i.no || "нет").toLowerCase()));
      });
      var text = b.name + " (" + (mode === "100" ? "на 100 г" : "порция " + fmt(t.g, 0) + " г") + ")\n" +
        picks.map(function (x) { return x + "\n"; }).join("") +
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
