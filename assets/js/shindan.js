/* ふさわしいゲーム診断
   - 診断プール(data/shindan.json)はビルド時に全エピソードから自動生成
   - 回答で5軸(歯ごたえ/物語/わいわい/クセ/時代)を採点しタイプを判定
   - ゲームは「番組でよく話題に出たタイトルほど出やすい」重み付き抽選。
     ただしクセ軸が強い人ほどマイナータイトルが出やすくなる
   - 名前+回答が同じなら同じ結果(診断としての再現性) */
(function () {
  "use strict";

  var panel = document.getElementById("shindanPanel");
  if (!panel) return;
  var SITE_URL = (panel.dataset.site || "").replace(/\/$/, "") + "/shindan.html";
  var HASHTAG = panel.dataset.hashtag || "#ゲームの滝壺";
  var AX = 5; // [歯ごたえC, 物語S, わいわいP, クセK, 時代T(+新作/-レトロ)]
  var NAME_MAX = 10; // なまえは全角10文字まで

  var QUESTIONS = [
    { q: "ゲームを始めるとき、いちばん胸が高鳴るのは?",
      c: [
        { t: "手強い相手や難関に挑むとき", d: [3, 0, 0, 0, 0] },
        { t: "物語や世界にのめり込むとき", d: [0, 3, 0, 0, 0] },
        { t: "誰かと一緒に盛り上がるとき", d: [0, 0, 3, 0, 0] },
        { t: "見たこともない変な遊びに出会うとき", d: [0, 0, 0, 3, 0] }
      ] },
    { q: "積みゲーを崩すなら、どんな夜?",
      c: [
        { t: "とことん歯を食いしばりたい夜", d: [3, 0, -1, 0, 0] },
        { t: "しみじみ物語に浸りたい夜", d: [-1, 3, 0, 0, 0] },
        { t: "だらだら癒されたい夜", d: [-3, 0, 0, 0, 0] },
        { t: "友達と通話しながら遊びたい夜", d: [0, 0, 3, 0, 0] }
      ] },
    { q: "あなたにとって「いいゲーム」の条件は?",
      c: [
        { t: "骨太な手応えがあること", d: [3, 0, 0, 0, 0] },
        { t: "忘れられない物語があること", d: [0, 3, 0, 0, 0] },
        { t: "何度でも遊べるシステムがあること", d: [1, -3, 0, 1, 0] },
        { t: "みんなの話題になっていること", d: [0, 0, 2, -1, 2] }
      ] },
    { q: "滝壺の3人でいうと、いちばん気になるのは?",
      c: [
        { t: "歯ごたえと歯ざわりにうるさい人", d: [3, 0, 0, 0, 0] },
        { t: "レトロの名作を掘り続ける人", d: [0, 1, 0, 0, -3] },
        { t: "変なゲームを見つけてくる人", d: [0, 0, 0, 3, 0] },
        { t: "眼鏡っ娘に一途な人", d: [0, 2, 0, 2, 0] }
      ] },
    { q: "次に遊ぶなら、どんな一本?",
      c: [
        { t: "誰も知らない尖った一本", d: [0, 0, -1, 3, 1] },
        { t: "みんなが知る王道の名作", d: [0, 1, 0, -3, 0] },
        { t: "いま話題の最新作", d: [0, 0, 1, 0, 3] },
        { t: "何年も語り継がれるレトロ", d: [0, 0, 0, 0, -3] }
      ] },
    { q: "ゲームオーバー画面を見たとき、あなたは?",
      c: [
        { t: "燃える。もう一回。", d: [3, 0, 0, 0, 0] },
        { t: "続きが気になって攻略を見ちゃう", d: [-1, 3, 0, 0, 0] },
        { t: "そっと電源を切って寝る", d: [-3, 0, 0, 0, 0] },
        { t: "「今のはわるい死に方だったな」と笑う", d: [0, 0, 1, 2, -1] }
      ] },
    { q: "理想の遊び方は?",
      c: [
        { t: "深夜にひとりでじっくり潜る", d: [1, 0, -3, 0, 0] },
        { t: "友達とわいわい騒ぎながら", d: [0, 0, 3, 0, 0] },
        { t: "実況や配信をおともに", d: [0, 1, 1, 0, 1] },
        { t: "ポッドキャストを聴きながら別ゲー", d: [0, 0, 0, 2, -1] }
      ] },
    { q: "ゲームに求める“余韻”は?",
      c: [
        { t: "心に刺さる読後感", d: [0, 3, 0, 0, 0] },
        { t: "手が勝手に伸びる中毒性", d: [2, -2, 0, 1, 0] },
        { t: "ほっとひと息の癒し", d: [-3, 0, 0, 0, 0] },
        { t: "誰かに話したくなる衝撃", d: [0, 0, 2, 2, 0] }
      ] }
  ];

  // タイプ: 主軸(絶対値最大)の正負で決定
  var TYPES = {
    "C+": ["歯ごたえ求道タイプ", "困難でこそ燃える人。理不尽すら「味」に変える胃袋の持ち主です。"],
    "C-": ["のんびり湯治タイプ", "ゲームは癒し。勝ち負けより湯加減、それがあなたの流儀です。"],
    "S+": ["物語どっぷりタイプ", "エンドロールの余韻で3日は生きられる、生粋のロマン派です。"],
    "S-": ["理論派ビルダータイプ", "物語よりシステム。効率と構築の美しさに痺れる設計者気質です。"],
    "P+": ["宴会番長タイプ", "ゲームはみんなでやるともっと旨い。場を沸かせる天性の幹事です。"],
    "P-": ["単独潜水タイプ", "深夜、ひとりで潜る時間こそ至福。孤高のダイバーです。"],
    "K+": ["珍味ハンタータイプ", "人が知らない変なゲームほど輝いて見える、選ばれし探求者です。"],
    "K-": ["王道まっしぐらタイプ", "名作と呼ばれるものには理由がある。真っ直ぐな審美眼の持ち主です。"],
    "T+": ["新作サーファータイプ", "時代の波は先頭で乗るのが気持ちいい。アンテナの感度は番組随一です。"],
    "T-": ["レトロ考古学タイプ", "思い出は美化ではなく熟成。過去の名作を掘り続ける学者肌です。"]
  };
  var AXIS_KEY = ["C", "S", "P", "K", "T"];

  var state = { name: "", idx: 0, answers: [], axes: [0, 0, 0, 0, 0] };
  var DATA = null; // shindan.json

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
    state.idx = 0; state.answers = []; state.axes = [0, 0, 0, 0, 0];
    var introShare = "ゲームの滝壺「ふさわしいゲーム診断」\nあなたに“ふさわしい一本”を全" + DATA.games.length + "タイトルから診断!\n" +
      HASHTAG + " #ふさわしいゲーム診断\n" + SITE_URL;
    panel.innerHTML =
      '<div class="sh-screen">' +
      '<p class="sh-lede">8つの質問に直感で答えるだけ。<br>診断結果は <strong>' + DATA.games.length + 'タイトル</strong>。あなたは何を引き当てる?</p>' +
      '<p class="sh-lede-sub">なまえや答えが変わると、結果も変わります。<br>新しい回が配信されるたびに結果の種類も増えるので、何度でも遊べます。</p>' +
      '<label class="sh-name-label" for="shName">なまえ(結果の画像に入ります・全角' + NAME_MAX + '文字まで)</label>' +
      '<input class="sh-name" id="shName" type="text" maxlength="' + NAME_MAX + '" placeholder="例: たわし" autocomplete="off">' +
      '<button class="sh-primary" id="shStart">診断をはじめる</button>' +
      '<div class="sh-intro-actions"><a class="sh-btn share" href="https://x.com/intent/post?text=' + encodeURIComponent(introShare) + '" target="_blank" rel="noopener">𝕏 この診断をシェアする</a></div>' +
      '<p class="sh-note">結果は画像でシェアできます。' + esc(HASHTAG) + ' を付けてポストしてくれたら、番組が喜びます。</p>' +
      '<p class="sh-fusa-link">※「ふさわしいゲーム」は番組の<a href="series/fusawashii.html">名物企画</a>から生まれた診断です</p>' +
      '</div>';
    var nameInput = document.getElementById("shName");
    var start = function () {
      state.name = nameInput.value.trim().slice(0, NAME_MAX);
      renderQuestion();
    };
    document.getElementById("shStart").addEventListener("click", start);
    nameInput.addEventListener("keydown", function (ev) { if (ev.key === "Enter") start(); });
  }

  /* ---------- 画面: 質問 ---------- */
  function renderQuestion() {
    var Q = QUESTIONS[state.idx];
    var pct = Math.round(state.idx / QUESTIONS.length * 100);
    var html =
      '<div class="sh-screen">' +
      '<div class="sh-meter"><span class="sh-count">Q' + (state.idx + 1) + ' / ' + QUESTIONS.length + '</span>' +
      '<span class="sh-track"><span class="sh-fill" id="shFill"></span></span></div>' +
      '<h2 class="sh-qtext">' + esc(Q.q) + '</h2><div class="sh-choices">';
    for (var i = 0; i < Q.c.length; i++) {
      html += '<button class="sh-choice" data-i="' + i + '"><span class="sh-bullet">' +
        String.fromCharCode(65 + i) + '</span><span>' + esc(Q.c[i].t) + '</span></button>';
    }
    html += "</div></div>";
    panel.innerHTML = html;
    requestAnimationFrame(function () {
      document.getElementById("shFill").style.width = pct + "%";
    });
    panel.querySelectorAll(".sh-choice").forEach(function (b) {
      b.addEventListener("click", function () {
        var ci = parseInt(b.getAttribute("data-i"), 10);
        var d = QUESTIONS[state.idx].c[ci].d;
        for (var k = 0; k < AX; k++) state.axes[k] += d[k];
        state.answers.push(ci);
        state.idx++;
        if (state.idx >= QUESTIONS.length) renderResult();
        else renderQuestion();
      });
    });
  }

  /* ---------- タイプ判定 ---------- */
  function judgeType() {
    var bi = 0, bv = -1;
    for (var k = 0; k < AX; k++) {
      var a = Math.abs(state.axes[k]);
      if (a > bv) { bv = a; bi = k; }
    }
    var key = AXIS_KEY[bi] + (state.axes[bi] >= 0 ? "+" : "-");
    return TYPES[key];
  }

  /* ---------- ゲーム抽選 ---------- */
  function pickGame() {
    var rng = mulberry32(hashStr(state.name + "|" + state.answers.join("")));
    var clamp = function (v) { return Math.max(-10, Math.min(10, v)); };
    var kuse = clamp(state.axes[3]) / 10;   // クセ軸: 高いほどマイナー優先
    var era = clamp(state.axes[4]) / 10;    // 時代軸: +新作(新しい回) / -レトロ(古い回)
    var expo = 2.0 - 1.6 * Math.max(0, kuse); // 基本はメジャー優先、クセMAXでほぼ均等
    var maxEp = DATA.maxEp || 1;

    var total = 0;
    var weights = DATA.games.map(function (g) {
      var w = Math.pow(g[1], expo);
      var rel = (g[2] / maxEp) * 2 - 1;   // -1(初期の回) .. +1(最新回)
      w *= 1 + 0.7 * era * rel;           // 時代の好みに合う回のゲームを優先
      if (w < 0.05) w = 0.05;
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
    var type = judgeType();
    var picked = pickGame();
    var g = picked.g;                      // [title, count, epNum, mainFlag]
    var rare = picked.rare;
    var pct = picked.pct;
    var ep = DATA.eps[String(g[2])];       // [epTitle, image]
    var dispName = state.name || "あなた";
    var rareBadge = rare === 2
      ? '<span class="sh-rare r2">★★★ 超レア!! 全' + DATA.games.length + 'タイトル中、一度だけ話題に出た幻の一本</span>'
      : rare === 1 ? '<span class="sh-rare r1">★★ レア! 知る人ぞ知る一本を引き当てました</span>' : "";
    var epLabel = g[3] ? "このタイトルについて話していそうな回" : "このタイトルの話をしているかもしれない回";
    var epImg = ep[1]
      ? '<img class="sh-ep-img" src="' + esc(ep[1]) + '" alt="" loading="lazy">'
      : '<span class="sh-ep-img sh-ep-num">#' + g[2] + "</span>";

    var shareText = dispName + "の“ふさわしいゲーム”は【" + g[0] + "】でした!\n(" + type[0] + "・ふさわしさ" + pct + "%)\n" +
      (rare === 2 ? "★一度しか話題に出ていない幻の一本を引き当てた!\n" : "") +
      HASHTAG + " #ふさわしいゲーム診断\n" + SITE_URL;

    panel.innerHTML =
      '<div class="sh-screen sh-result">' +
      '<div class="sh-r-eyebrow">RESULT</div>' +
      '<p class="sh-r-type">' + esc(dispName) + ' さんは…<strong>' + esc(type[0]) + '</strong></p>' +
      '<p class="sh-r-typedesc">' + esc(type[1]) + '</p>' +
      '<div class="sh-r-card' + (rare === 2 ? " r2" : rare === 1 ? " r1" : "") + '">' +
      '<div class="sh-r-label">そんなあなたに、滝壺データベースが選んだ一本は</div>' +
      '<div class="sh-r-title">' + esc(g[0]) + '</div>' +
      rareBadge +
      '<div class="sh-r-count">ふさわしさ <strong>' + pct + '%</strong> ・ 滝壺での登場 <strong>' + g[1] + '回</strong></div>' +
      '</div>' +
      '<div class="sh-ep-block"><p class="sh-ep-label">🎧 ' + epLabel + '</p>' +
      '<a class="sh-ep-card" href="episodes/' + g[2] + '.html">' + epImg +
      '<span class="sh-ep-body"><span class="sh-ep-hash">#' + g[2] + '</span><span class="sh-ep-title">' + esc(ep[0]) + '</span></span></a></div>' +
      '<div class="sh-canvas-wrap"><canvas id="shCanvas" width="1080" height="1350"></canvas></div>' +
      '<div class="sh-actions">' +
      '<button class="sh-btn save" id="shSave">📥 画像を保存</button>' +
      '<button class="sh-btn copy" id="shCopy">📋 画像をコピー</button>' +
      '<a class="sh-btn share" id="shX" href="https://x.com/intent/post?text=' + encodeURIComponent(shareText) + '" target="_blank" rel="noopener">𝕏 Xでシェアする</a>' +
      '</div>' +
      '<p class="sh-note">画像を保存/コピーしてから、Xのポストに添付すると盛り上がります!</p>' +
      '<button class="sh-btn retry" id="shRetry">🔄 もう一度診断する</button>' +
      '<p class="sh-fusa-link">※「ふさわしいゲーム」は番組の<a href="series/fusawashii.html">名物企画</a>から生まれた診断です</p>' +
      '</div>';

    drawShareImage(dispName, type[0], g, ep, rare, pct);

    document.getElementById("shRetry").addEventListener("click", renderIntro);
    document.getElementById("shSave").addEventListener("click", function () {
      var a = document.createElement("a");
      a.download = "fusawashii-shindan.png";
      a.href = document.getElementById("shCanvas").toDataURL("image/png");
      a.click();
    });
    document.getElementById("shCopy").addEventListener("click", function () {
      var btn = this;
      var canvas = document.getElementById("shCanvas");
      canvas.toBlob(function (blob) {
        if (blob && navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(
            function () { btn.textContent = "✅ コピーしました!"; setTimeout(function () { btn.textContent = "📋 画像をコピー"; }, 1800); },
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

  function drawShareImage(name, typeName, g, ep, rare, pct) {
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
      // 画像の注釈
      ctx.font = "700 21px " + FAMILY;
      ctx.fillStyle = "#0E5AA8";
      ctx.fillText("※画像は“この話をしてそうな回”のジャケットです", CX, ay + as + 42);

      // ===== ゲームタイトル(大きく) =====
      var titleTop = 858;
      var fit = fitTitle(ctx, g[0], W - 110, 160, FAMILY, 72);
      ctx.fillStyle = "#10395C";
      var ty = titleTop + fit.size;
      fit.lines.forEach(function (ln) {
        ctx.font = "900 " + fit.size + "px " + FAMILY;
        ctx.fillText(ln, CX, ty);
        ty += fit.size * 1.22;
      });
      ty += 18;

      // タイプのピル
      pill(typeName, ty, "700 34px", 30, 60,
        function () { ctx.fillStyle = "#EE5A3A"; ctx.fill(); }, "#fff");
      ty += 60 + 18;

      // レアバッジ
      if (rare === 2) {
        pill("★★★ 超レア!! 一度だけ話題に出た幻の一本", ty, "900 30px", 28, 58,
          function (x, w) {
            var gr = ctx.createLinearGradient(x, 0, x + w, 0);
            gr.addColorStop(0, "#FFD75E"); gr.addColorStop(1, "#FFAF2E");
            ctx.fillStyle = gr; ctx.fill();
          }, "#6B3C00");
        ty += 58 + 18;
      } else if (rare === 1) {
        pill("★★ レア! 知る人ぞ知る一本", ty, "900 30px", 26, 56,
          function () { ctx.fillStyle = "#B482F0"; ctx.fill(); }, "#fff");
        ty += 56 + 18;
      }

      // ふさわしさ% / 登場回数(半透明の濃紺ピルに白文字。どの背景でも読める)
      pill("ふさわしさ " + pct + "%　／　滝壺での登場 " + g[1] + "回", ty, "700 30px", 26, 56,
        function () { ctx.fillStyle = "rgba(12, 46, 90, .30)"; ctx.fill(); }, "#fff");

      // ===== 下部: フッター(帯なし。背景の濃青に白文字を地続きで載せる) =====
      ctx.save();
      ctx.shadowColor = "rgba(6, 34, 70, .55)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = "700 26px " + FAMILY;
      ctx.fillText(HASHTAG + "　#ふさわしいゲーム診断", CX, 1298);
      ctx.fillStyle = "#fff";
      ctx.font = "900 36px " + FAMILY;
      ctx.fillText("あなたもゲームの滝壺で診断しよう!", CX, 1340);
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
