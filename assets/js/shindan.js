/* ふさわしいゲーム診断
   - 診断プール(data/shindan.json)はビルド時に全エピソードから自動生成
   - ゲームは「番組でよく話題に出たタイトルほど出やすい」重み付き抽選。
   - 名前をシードにするため、同じ診断プールでは同じ名前から同じ結果になる */
(function () {
  "use strict";

  var panel = document.getElementById("shindanPanel");
  if (!panel) return;
  var SITE_URL = (panel.dataset.site || "").replace(/\/$/, "") + "/shindan.html";
  var HASHTAG = panel.dataset.hashtag || "#ゲームの滝壺";
  var NAME_MAX = 10; // なまえは全角10文字まで

  var state = { name: "" };
  var DATA = null; // shindan.json

  // Xロゴ(サイト共通のヘッダー/エピソードページと同じもの)
  var X_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.4Z"/></svg>';

  // GA4イベント送信(GA未導入・広告ブロッカー環境では何もしない)
  function track(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- シード付き乱数(名前+回答で結果が決まる) ---------- */
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 画面: イントロ ---------- */
  function renderIntro() {
    var introShare = "ゲームの滝壺「ふさわしいゲーム診断」\nあなたに“ふさわしい一本”を全" + DATA.games.length + "タイトルから診断！\n" +
      HASHTAG + " #ふさわしいゲーム診断\n" + SITE_URL;
    panel.innerHTML =
      '<div class="sh-screen">' +
      '<p class="sh-lede">なまえを入力するだけ。<br>滝壺で語られた <strong>' + DATA.games.length + 'タイトル</strong> から、<br>あなたにふさわしい一本を決定します。</p>' +
      '<p class="sh-lede-sub">なまえが変わると、結果も変わります。<br>新しい回が配信されるたびに候補も増えていきます。</p>' +
      '<form class="sh-name-form" id="shForm" novalidate>' +
      '<label class="sh-name-label" for="shName">なまえ（結果と画像に入ります・' + NAME_MAX + '文字まで）</label>' +
      '<input class="sh-name" id="shName" type="text" maxlength="' + NAME_MAX + '" placeholder="例: たわし" autocomplete="off" required aria-describedby="shNameError" value="' + esc(state.name || "") + '">' +
      '<p class="sh-name-error" id="shNameError" aria-live="polite"></p>' +
      '<button class="sh-primary" type="submit">ふさわしいゲームを決める</button>' +
      '</form>' +
      '<p class="sh-note">結果は画像でシェアできます。' + esc(HASHTAG) + ' を付けてポストしてくれたら、番組が喜びます。</p>' +
      '<p class="sh-intro-share"><a href="https://x.com/intent/post?text=' + encodeURIComponent(introShare) + '" target="_blank" rel="noopener">' + X_SVG + 'この診断を友達にシェア</a></p>' +
      '<p class="sh-fusa-link">※「ふさわしいゲーム」は番組の<a href="series/fusawashii.html">名物企画</a>から生まれた診断です</p>' +
      '</div>';
    var nameInput = document.getElementById("shName");
    var nameError = document.getElementById("shNameError");
    nameInput.addEventListener("input", function () {
      if (nameInput.value.trim()) {
        nameInput.removeAttribute("aria-invalid");
        nameError.textContent = "";
      }
    });
    document.getElementById("shForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      state.name = nameInput.value.trim().slice(0, NAME_MAX);
      if (!state.name) {
        nameInput.setAttribute("aria-invalid", "true");
        nameError.textContent = "なまえを入力してください。";
        nameInput.focus();
        return;
      }
      track("shindan_start");
      renderResult();
    });
  }

  /* ---------- ゲーム抽選 ---------- */
  function pickGame() {
    var seedName = state.name.normalize ? state.name.normalize("NFKC").toLowerCase() : state.name.toLowerCase();
    var rng = mulberry32(hashStr(seedName));

    var total = 0;
    var weights = DATA.games.map(function (g) {
      // 人気作への偏りと、一度だけ登場したタイトルを引く楽しさのバランスを取る
      var w = Math.pow(g[1], 1.5);
      total += w;
      return w;
    });
    var r = rng() * total;
    var game = DATA.games[DATA.games.length - 1];
    for (var i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { game = DATA.games[i]; break; }
    }
    var rare = game[1] === 1 ? 2 : (game[1] <= 3 ? 1 : 0);
    // ふさわしさ%(お遊び): シード由来で決定。超レアは運命の99%
    var pct = rare === 2 ? 99 : 80 + Math.floor(rng() * 20);
    return { g: game, rare: rare, pct: pct };
  }

  /* ---------- 画面: 結果 ---------- */
  function renderResult() {
    var picked = pickGame();
    var g = picked.g;                      // [title, count, epNum, mainFlag]
    var rare = picked.rare;
    var pct = picked.pct;
    var ep = DATA.eps[String(g[2])];       // [epTitle, image]
    var dispName = state.name || "あなた";
    var rareBadge = rare === 2
      ? '<span class="sh-rare r2">★★★ 超レア！！ 全' + DATA.games.length + 'タイトル中、一度だけ話題に出た幻の一本</span>'
      : rare === 1 ? '<span class="sh-rare r1">★★ レア！ 知る人ぞ知る一本を引き当てました</span>' : "";
    var epLabel = g[3] ? "このタイトルについて話していそうな回" : "このタイトルの話をしているかもしれない回";
    var epImg = ep[1]
      ? '<img class="sh-ep-img" src="' + esc(ep[1]) + '" alt="" loading="lazy">'
      : '<span class="sh-ep-img sh-ep-num">#' + g[2] + "</span>";

    var shareText = dispName + "の“ふさわしいゲーム”は【" + g[0] + "】でした！\n（ふさわしさ" + pct + "%）\n" +
      (rare === 2 ? "★一度しか話題に出ていない幻の一本を引き当てた！\n" : "") +
      HASHTAG + " #ふさわしいゲーム診断\n" + SITE_URL;

    panel.innerHTML =
      '<div class="sh-screen sh-result">' +
      '<div class="sh-r-eyebrow">RESULT</div>' +
      '<p class="sh-r-name"><strong>' + esc(dispName) + ' さん</strong>に<br>ふさわしいゲームは…</p>' +
      '<div class="sh-r-card' + (rare === 2 ? " r2" : rare === 1 ? " r1" : "") + '">' +
      '<div class="sh-r-label">滝壺データベースが選んだ一本</div>' +
      '<div class="sh-r-title">' + esc(g[0]) + '</div>' +
      rareBadge +
      '<div class="sh-r-count">ふさわしさ <strong>' + pct + '%</strong> ・ 滝壺での登場 <strong>' + g[1] + '回</strong></div>' +
      '</div>' +
      '<div class="sh-ep-block"><p class="sh-ep-label">🎧 ' + epLabel + '</p>' +
      '<a class="sh-ep-card" href="episodes/' + g[2] + '.html">' + epImg +
      '<span class="sh-ep-body"><span class="sh-ep-hash">#' + g[2] + '</span><span class="sh-ep-title">' + esc(ep[0]) + '</span></span></a>' +
      '<p class="sh-db-link">📚 <a href="games/?q=' + encodeURIComponent(g[0]) + '">滝壺データベースで「' + esc(g[0]) + '」の登場回をぜんぶ見る</a></p></div>' +
      '<div class="sh-canvas-wrap"><canvas id="shCanvas" width="1080" height="1350"></canvas></div>' +
      '<div class="sh-actions">' +
      '<button class="sh-btn save" id="shSave">📥 画像を保存</button>' +
      '<button class="sh-btn copy" id="shCopy">📋 画像をコピー</button>' +
      '<a class="sh-btn share" id="shX" href="https://x.com/intent/post?text=' + encodeURIComponent(shareText) + '" target="_blank" rel="noopener">' + X_SVG + 'Xでシェアする</a>' +
      '</div>' +
      '<p class="sh-note">画像を保存/コピーしてから、Xのポストに添付すると盛り上がります！</p>' +
      '<button class="sh-btn retry" id="shRetry">🔄 なまえを変えてもう一度</button>' +
      '<p class="sh-fusa-link">※「ふさわしいゲーム」は番組の<a href="series/fusawashii.html">名物企画</a>から生まれた診断です</p>' +
      '</div>';

    drawShareImage(dispName, g, ep, rare, pct);

    track("shindan_complete", {
      result_title: g[0],
      result_rare: rare,
      result_pct: pct
    });

    document.getElementById("shX").addEventListener("click", function () {
      track("shindan_share_x", { result_title: g[0] });
    });
    document.getElementById("shRetry").addEventListener("click", function () {
      track("shindan_retry");
      renderIntro();
      // 結果ページの下部にいるので、診断の先頭(ページ最上部)へ戻す
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.getElementById("shSave").addEventListener("click", function () {
      track("shindan_save", { result_title: g[0] });
      var a = document.createElement("a");
      a.download = "fusawashii-shindan.png";
      a.href = document.getElementById("shCanvas").toDataURL("image/png");
      a.click();
    });
    document.getElementById("shCopy").addEventListener("click", function () {
      track("shindan_copy", { result_title: g[0] });
      var btn = this;
      var canvas = document.getElementById("shCanvas");
      canvas.toBlob(function (blob) {
        if (blob && navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(
            function () { btn.textContent = "✅ コピーしました！"; setTimeout(function () { btn.textContent = "📋 画像をコピー"; }, 1800); },
            function () { btn.textContent = "保存ボタンをお使いください"; setTimeout(function () { btn.textContent = "📋 画像をコピー"; }, 2200); });
        } else {
          btn.textContent = "このブラウザでは保存をお使いください";
          setTimeout(function () { btn.textContent = "📋 画像をコピー"; }, 2200);
        }
      }, "image/png");
    });
  }

  /* ---------- シェア画像の描画 ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // 1行テキストが収まるフォントサイズを探す
  function fitFont(ctx, text, maxW, base, min, weight, family) {
    for (var s = base; s >= min; s -= 2) {
      ctx.font = weight + " " + s + "px " + family;
      if (ctx.measureText(text).width <= maxW) return s;
    }
    return min;
  }
  // タイトルを折り返し。最大3行+高さ制約。それでも収まらない超長タイトルは「…」で切る
  function fitTitle(ctx, text, maxW, maxH, family, startSize) {
    var size, lines, cur, i;
    for (size = (startSize || 52); size >= 30; size -= 4) {
      var maxLines = Math.min(3, Math.floor(maxH / (size * 1.22)));
      if (maxLines < 1) continue;
      ctx.font = "900 " + size + "px " + family;
      lines = []; cur = "";
      for (i = 0; i < text.length; i++) {
        if (ctx.measureText(cur + text[i]).width > maxW) { lines.push(cur); cur = text[i]; }
        else cur += text[i];
      }
      lines.push(cur);
      if (lines.length <= maxLines) return { lines: lines, size: size };
    }
    // 最小サイズでも入らない → 3行に詰めて末尾を「…」に
    size = 34;
    ctx.font = "900 " + size + "px " + family;
    lines = []; cur = "";
    for (i = 0; i < text.length && lines.length < 3; i++) {
      if (ctx.measureText(cur + text[i]).width > maxW) { lines.push(cur); cur = text[i]; }
      else cur += text[i];
    }
    if (lines.length < 3 && cur) lines.push(cur);
    var last = lines[lines.length - 1];
    while (last.length && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = last + "…";
    return { lines: lines, size: size };
  }

  function drawShareImage(name, g, ep, rare, pct) {
    var canvas = document.getElementById("shCanvas");
    var ctx = canvas.getContext("2d");
    var W = 1080, H = 1350;                 // スマホ向け縦長(X表示に最適な4:5)
    var CX = W / 2;
    var FAMILY = '"Zen Maru Gothic","Hiragino Maru Gothic ProN",sans-serif';

    function pill(text, cy, font, padX, hgt, fillCb, textColor) {
      ctx.font = font + " " + FAMILY;
      var w = ctx.measureText(text).width + padX * 2;
      var x = CX - w / 2;
      roundRect(ctx, x, cy, w, hgt, hgt / 2);
      fillCb(x, w);
      ctx.fillStyle = textColor;
      ctx.textBaseline = "middle";
      ctx.fillText(text, CX, cy + hgt / 2 + 2);
      ctx.textBaseline = "alphabetic";
    }

    var draw = function (img, logo) {
      ctx.textAlign = "center";
      // 背景: 境界のない一枚の水中グラデーション。
      // 上部(白文字ゾーン)と下部(フッター)は濃い青、中央(タイトルゾーン)は明るく。
      var bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#1E7ED6");
      bg.addColorStop(.2, "#83C6F2");
      bg.addColorStop(.46, "#E3F3FD");
      bg.addColorStop(.72, "#D2EBFB");
      bg.addColorStop(.86, "#7FB4E4");
      bg.addColorStop(1, "#184C87");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // 水面から差し込む光(スタイリッシュな斜めビーム)
      ctx.save();
      ctx.globalAlpha = .16;
      [[180, 340], [520, 260], [860, 380]].forEach(function (p) {
        var beam = ctx.createLinearGradient(p[0], 0, p[0] - 120, p[1] + 500);
        beam.addColorStop(0, "rgba(255,255,255,.9)");
        beam.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(p[0] - 26, -20); ctx.lineTo(p[0] + 46, -20);
        ctx.lineTo(p[0] - 60, p[1] + 520); ctx.lineTo(p[0] - 150, p[1] + 520);
        ctx.closePath(); ctx.fill();
      });
      ctx.restore();
      // レア専用の後光(アートワーク中心に)
      var glowCY = 620;
      if (rare === 2) {
        var glow = ctx.createRadialGradient(CX, glowCY, 80, CX, glowCY, 640);
        glow.addColorStop(0, "rgba(255,214,90,.6)");
        glow.addColorStop(.55, "rgba(255,214,90,.18)");
        glow.addColorStop(1, "rgba(255,214,90,0)");
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(255,226,130,.9)";
        [[120, 360, 6], [980, 420, 8], [900, 300, 5], [200, 700, 6], [960, 760, 5], [140, 900, 5], [930, 980, 6]].forEach(function (p) {
          ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, 7); ctx.fill();
        });
      } else if (rare === 1) {
        var pglow = ctx.createRadialGradient(CX, glowCY, 80, CX, glowCY, 620);
        pglow.addColorStop(0, "rgba(180,130,240,.42)");
        pglow.addColorStop(1, "rgba(180,130,240,0)");
        ctx.fillStyle = pglow; ctx.fillRect(0, 0, W, H);
      }
      // 泡(全体に散らして水中の一体感を出す)
      ctx.fillStyle = "rgba(255,255,255,.35)";
      [[90, 300, 9], [180, 430, 5], [980, 340, 11], [930, 250, 6], [70, 660, 6], [1000, 640, 7],
       [120, 1080, 8], [940, 60, 7], [1010, 140, 5], [520, 66, 5], [80, 1240, 6], [990, 1180, 8], [880, 1300, 5]].forEach(function (b) {
        ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, 7); ctx.fill();
      });

      // ===== 上部: ブランド(境界なし、透過ロゴをそのまま浮かべる) =====
      var ls = 210, lx = 30, ly = 16;
      if (logo) {
        ctx.save();
        ctx.shadowColor = "rgba(8, 40, 80, .45)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
        ctx.translate(lx + ls / 2, ly + ls / 2);
        ctx.rotate(-4 * Math.PI / 180);
        ctx.drawImage(logo, -ls / 2, -ls / 2, ls, ls);
        ctx.restore();
      }
      // ロゴ右のテキスト(白+影で濃青の上に)
      var htx = lx + ls + 26;
      ctx.textAlign = "left";
      ctx.save();
      ctx.shadowColor = "rgba(10, 50, 100, .5)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = "700 27px " + FAMILY;
      ctx.fillText("ゲームの滝壺｜ゲーム系ポッドキャスト", htx, 92);
      ctx.fillStyle = "#fff";
      ctx.font = "900 60px " + FAMILY;
      ctx.fillText("ふさわしいゲーム診断", htx, 158);
      ctx.restore();
      // コーラルのアクセント下線
      ctx.fillStyle = "#EE5A3A";
      roundRect(ctx, htx, 176, 296, 8, 4); ctx.fill();
      ctx.textAlign = "center";

      // ===== 名前行(まだ青が濃いゾーンなので白+影) =====
      ctx.save();
      ctx.shadowColor = "rgba(10, 50, 100, .45)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      ctx.fillStyle = "#fff";
      var nameLine = "🎮 " + name + " さんに ふさわしい一本は…";
      var ns = fitFont(ctx, nameLine, W - 120, 40, 26, "700", FAMILY);
      ctx.font = "700 " + ns + "px " + FAMILY;
      ctx.fillText(nameLine, CX, 268);
      ctx.restore();

      // ===== アートワーク(大きく中央) =====
      var as = 480, ax = CX - as / 2, ay = 288;
      ctx.save();
      ctx.shadowColor = "rgba(14,90,168,.5)"; ctx.shadowBlur = 46; ctx.shadowOffsetY = 16;
      roundRect(ctx, ax, ay, as, as, 40); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.restore();
      ctx.save();
      roundRect(ctx, ax, ay, as, as, 40); ctx.clip();
      if (img) ctx.drawImage(img, ax, ay, as, as);
      else {
        ctx.fillStyle = "#1E7ED6"; ctx.fillRect(ax, ay, as, as);
        ctx.fillStyle = "#fff"; ctx.font = "900 130px " + FAMILY;
        ctx.textBaseline = "middle"; ctx.fillText("#" + g[2], CX, ay + as / 2);
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();

      // レアはアートワーク右上に「スタンプ」で表示(縦の積み上げから外して重なりを防ぐ)
      if (rare === 2 || rare === 1) {
        var bt = rare === 2 ? "★★★ 超レア！" : "★★ レア！";
        ctx.save();
        ctx.translate(ax + as - 18, ay + 39);
        ctx.rotate(9 * Math.PI / 180);
        ctx.font = "900 34px " + FAMILY;
        var bw = ctx.measureText(bt).width + 44, bh = 62;
        ctx.shadowColor = "rgba(0,0,0,.32)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
        roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
        if (rare === 2) {
          var gg = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
          gg.addColorStop(0, "#FFD75E"); gg.addColorStop(1, "#FFAF2E");
          ctx.fillStyle = gg;
        } else ctx.fillStyle = "#A96BE8";
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,.9)";
        roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.stroke();
        ctx.fillStyle = rare === 2 ? "#6B3C00" : "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(bt, 0, 2);
        ctx.textBaseline = "alphabetic";
        ctx.restore();
      }

      // 画像の注釈
      ctx.textAlign = "center";
      ctx.font = "700 21px " + FAMILY;
      ctx.fillStyle = "#0E5AA8";
      ctx.fillText("※画像は“この話をしてそうな回”のジャケットです", CX, ay + as + 42);

      // ===== ゲームタイトル(タイプ表示をなくし、一本の名前を主役に) =====
      ctx.fillStyle = "#EE5A3A";
      ctx.font = "900 25px " + FAMILY;
      ctx.fillText("FUSAWASHII GAME", CX, 862);
      var titleTop = 882;
      var fit = fitTitle(ctx, g[0], W - 110, 210, FAMILY, 76);
      ctx.fillStyle = "#10395C";
      var ty = titleTop + fit.size;
      fit.lines.forEach(function (ln) {
        ctx.font = "900 " + fit.size + "px " + FAMILY;
        ctx.fillText(ln, CX, ty);
        ty += fit.size * 1.22;
      });
      ty += 26;

      // ふさわしさ% / 登場回数(半透明の濃紺ピルに白文字。どの背景でも読める)
      // レアはアートワーク角のスタンプに出しているので、ここは常にこの1行だけ
      pill("ふさわしさ " + pct + "%　／　滝壺での登場 " + g[1] + "回", ty, "700 30px", 26, 56,
        function () { ctx.fillStyle = "rgba(12, 46, 90, .30)"; ctx.fill(); }, "#fff");

      // ===== 下部: フッター(帯なし。背景の濃青に白文字を地続きで載せる) =====
      ctx.save();
      ctx.shadowColor = "rgba(6, 34, 70, .55)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = "700 26px " + FAMILY;
      ctx.fillText(HASHTAG + "　#ふさわしいゲーム診断", CX, 1288);
      ctx.fillStyle = "#fff";
      ctx.font = "900 36px " + FAMILY;
      ctx.fillText("あなたもゲームの滝壺で診断しよう！", CX, 1330);
      ctx.restore();
    };

    // ロゴ画像とエピソード画像を両方読み込んでから描画
    function load(src, cb) {
      if (!src) { cb(null); return; }
      var im = new Image();
      im.onload = function () { cb(im); };
      im.onerror = function () { cb(null); };
      im.src = src;
    }
    var start = function () {
      load("assets/img/mainlogo.webp", function (logo) {
        load(ep[1], function (art) { draw(art, logo); });
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    else start();
  }

  /* ---------- 起動 ---------- */
  fetch("data/shindan.json" + (window.__shindanVer ? "?v=" + window.__shindanVer : ""))
    .then(function (r) { return r.json(); })
    .then(function (d) { DATA = d; renderIntro(); })
    .catch(function () {
      panel.innerHTML = '<p style="text-align:center;color:var(--faint);padding:40px 0;">診断データの読み込みに失敗しました。ページを再読み込みしてください。</p>';
    });
})();
