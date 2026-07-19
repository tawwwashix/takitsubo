/* サイト内プレイヤー
   - RSSのenclosure(MP3)をHTML5 Audioで直接再生(Spotify埋め込みの置き換え)
   - チャプターのタップで頭出し / 再生中のチャプターをハイライト
   - 倍速・±スキップ・「前回のつづきから」(localStorage)・?t=秒 の頭出しリンク対応
   - プレイヤーが画面外に出たらミニプレイヤーを表示 */
(function () {
  "use strict";

  var box = document.getElementById("tkPlayer");
  if (!box) return;

  var EP = box.dataset.ep || "";
  var TITLE = box.dataset.title || document.title;
  var SHOW = box.dataset.show || "";
  var IMAGE = box.dataset.image || "";
  var POS_KEY = "tkpos:" + EP;
  var RATE_KEY = "tkrate";
  var RATES = [1, 1.2, 1.5, 1.7, 2, 0.8];

  var playBtn = box.querySelector(".tkp-play");
  var seek = box.querySelector(".tkp-seek");
  var curEl = box.querySelector(".tkp-cur");
  var durEl = box.querySelector(".tkp-dur");
  var rateBtn = box.querySelector(".tkp-rate");
  var backBtn = box.querySelector(".tkp-back");
  var fwdBtn = box.querySelector(".tkp-fwd");
  var copyBtn = box.querySelector(".tkp-copy");
  var noteEl = box.querySelector(".tkp-note");
  var COPY_LABEL = copyBtn ? copyBtn.innerHTML : "";

  var chapRows = [].slice.call(document.querySelectorAll(".chap-row[data-t]"));
  var chapTimes = chapRows.map(function (b) { return parseFloat(b.dataset.t) || 0; });

  var audio = new Audio();
  audio.preload = "none";
  audio.src = box.dataset.audio;

  var duration = parseFloat(box.dataset.duration) || 0;
  var started = false;      // 一度でも再生したか
  var dragging = false;     // シークバーをドラッグ中か
  var pendingSeek = null;   // メタデータ読み込み前に頼まれた頭出し位置

  function track(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }

  function fmt(s) {
    s = Math.max(0, Math.round(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    if (h) return h + ":" + String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
    return m + ":" + String(ss).padStart(2, "0");
  }

  function curDuration() {
    return (audio.duration && isFinite(audio.duration)) ? audio.duration : duration;
  }
  function currentTime() {
    return pendingSeek != null ? pendingSeek : audio.currentTime;
  }

  /* ---------- 再生位置の保存(続きから再生) ---------- */
  function save(t) {
    try {
      var d = curDuration();
      if (t < 20 || (d && t > d - 45)) localStorage.removeItem(POS_KEY);
      else localStorage.setItem(POS_KEY, JSON.stringify({ t: Math.floor(t), ts: Date.now() }));
    } catch (e) {}
  }
  function loadSaved() {
    try {
      var v = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (v && v.t > 20 && (!duration || v.t < duration - 45)) return v.t;
    } catch (e) {}
    return null;
  }

  /* ---------- シーク ---------- */
  function applySeek(t) {
    var d = curDuration();
    t = Math.max(0, d ? Math.min(t, Math.max(0, d - 0.5)) : t);
    if (audio.readyState >= 1) {
      audio.currentTime = t;
    } else {
      pendingSeek = t;
      renderTime(t);
      try { audio.load(); } catch (e) {}
    }
  }
  audio.addEventListener("loadedmetadata", function () {
    if (audio.duration && isFinite(audio.duration)) duration = audio.duration;
    durEl.textContent = fmt(duration);
    seek.max = Math.floor(duration);
    if (pendingSeek != null) {
      audio.currentTime = pendingSeek;
      pendingSeek = null;
    }
  });

  function play() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () { /* 自動再生がブロックされた場合は待機のまま */ });
  }
  function toggle() { if (audio.paused) play(); else audio.pause(); }

  function jumpTo(t, autoplay) {
    applySeek(t);
    if (autoplay) play();
  }

  /* ---------- 表示更新 ---------- */
  function paintSeek() {
    var max = parseFloat(seek.max) || 1;
    var pct = Math.min(100, (parseFloat(seek.value) / max) * 100);
    seek.style.background = "linear-gradient(90deg, var(--primary) " + pct + "%, var(--line) " + pct + "%)";
  }

  function highlight(t) {
    if (!chapRows.length) return;
    var idx = -1;
    for (var i = 0; i < chapTimes.length; i++) {
      if (t >= chapTimes[i] - 0.5) idx = i; else break;
    }
    for (var j = 0; j < chapRows.length; j++) {
      chapRows[j].parentElement.classList.toggle("now", j === idx && (started || t > 0));
    }
  }

  function renderTime(t) {
    curEl.textContent = fmt(t);
    if (!dragging) {
      seek.value = Math.floor(t);
      paintSeek();
    }
    highlight(t);
    updateMini();
  }

  var lastSave = 0;
  audio.addEventListener("timeupdate", function () {
    renderTime(audio.currentTime);
    var now = Date.now();
    if (!audio.paused && now - lastSave > 5000) {
      lastSave = now;
      save(audio.currentTime);
    }
  });

  audio.addEventListener("play", function () {
    if (!started) {
      started = true;
      track("player_play", { ep: EP });
    }
    box.classList.add("playing");
    mini.classList.add("playing");
    syncMini();
  });
  audio.addEventListener("pause", function () {
    box.classList.remove("playing");
    mini.classList.remove("playing");
    if (started) save(audio.currentTime);
    syncMini();
  });
  audio.addEventListener("ended", function () {
    try { localStorage.removeItem(POS_KEY); } catch (e) {}
    track("player_complete", { ep: EP });
  });
  audio.addEventListener("error", function () {
    if (!audio.src) return;
    note("⚠ 音声を読み込めませんでした。通信状況をご確認いただくか、下の各サービスからお聴きください。");
  });

  /* ---------- 操作 ---------- */
  playBtn.addEventListener("click", toggle);

  seek.addEventListener("input", function () {
    dragging = true;
    curEl.textContent = fmt(parseFloat(seek.value));
    paintSeek();
  });
  seek.addEventListener("change", function () {
    dragging = false;
    applySeek(parseFloat(seek.value));
  });

  backBtn.addEventListener("click", function () { applySeek(currentTime() - 10); });
  fwdBtn.addEventListener("click", function () { applySeek(currentTime() + 30); });

  function setRate(r) {
    audio.playbackRate = r;
    rateBtn.textContent = r.toFixed(1) + "x";
    try { localStorage.setItem(RATE_KEY, String(r)); } catch (e) {}
  }
  rateBtn.addEventListener("click", function () {
    var i = RATES.indexOf(audio.playbackRate);
    setRate(RATES[(i + 1) % RATES.length]);
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var t = Math.floor(currentTime());
      var url = location.origin + location.pathname + (t > 0 ? "?t=" + t : "");
      var done = function () {
        copyBtn.textContent = "✅ コピーしました！";
        setTimeout(function () { copyBtn.innerHTML = COPY_LABEL; }, 1800);
      };
      var fallback = function () {
        var ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
        done();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, fallback);
      } else fallback();
      track("player_copy_link", { ep: EP, t: t });
    });
  }

  chapRows.forEach(function (b) {
    b.addEventListener("click", function () {
      var t = parseFloat(b.dataset.t) || 0;
      jumpTo(t, true);
      track("player_chapter", { ep: EP, t: Math.floor(t) });
    });
  });

  /* ---------- おしらせ行(続きから/頭出し/エラー) ---------- */
  function note(html, withRestart) {
    noteEl.innerHTML = html + (withRestart
      ? ' <button type="button" class="tkp-restart">最初から聴く</button>' : "");
    noteEl.hidden = false;
    var r = noteEl.querySelector(".tkp-restart");
    if (r) r.addEventListener("click", function () {
      applySeek(0);
      try { localStorage.removeItem(POS_KEY); } catch (e) {}
      noteEl.hidden = true;
    });
  }

  /* ---------- ミニプレイヤー(スクロールで本体が隠れたら出る) ---------- */
  var mini = document.createElement("div");
  mini.className = "tk-mini";
  mini.innerHTML =
    '<button class="tk-mini-play" type="button" aria-label="再生 / 一時停止">' +
    '<svg class="i-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72L19 12 8 5.14z"/></svg>' +
    '<svg class="i-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.6v14H7V5zm6.4 0H17v14h-3.6V5z"/></svg>' +
    '</button>' +
    '<span class="tk-mini-body"><span class="tk-mini-title"></span><span class="tk-mini-bar"><i></i></span></span>' +
    '<span class="tk-mini-time">0:00</span>';
  document.body.appendChild(mini);
  var miniTitle = mini.querySelector(".tk-mini-title");
  var miniFill = mini.querySelector(".tk-mini-bar i");
  var miniTime = mini.querySelector(".tk-mini-time");
  miniTitle.textContent = TITLE;

  mini.querySelector(".tk-mini-play").addEventListener("click", function (ev) {
    ev.stopPropagation();
    toggle();
  });
  mini.addEventListener("click", function () {
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  function updateMini() {
    if (!mini.classList.contains("show")) return;
    var d = curDuration() || 1;
    miniFill.style.width = Math.min(100, (audio.currentTime / d) * 100) + "%";
    miniTime.textContent = fmt(audio.currentTime);
    var nowLabel = document.querySelector(".tk-chapters li.now .chap-label");
    miniTitle.textContent = nowLabel ? nowLabel.textContent : TITLE;
  }

  var heroVisible = true;
  function syncMini() {
    var show = started && !heroVisible;
    mini.classList.toggle("show", show);
    document.body.classList.toggle("tk-mini-on", show);
    updateMini();
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      syncMini();
    }, { rootMargin: "-56px 0px 0px 0px" }).observe(box);
  }

  /* ---------- OS連携(ロック画面・イヤホンのボタン) ---------- */
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: TITLE,
        artist: SHOW,
        artwork: IMAGE ? [{ src: IMAGE, sizes: "800x800", type: "image/jpeg" }] : []
      });
      navigator.mediaSession.setActionHandler("play", play);
      navigator.mediaSession.setActionHandler("pause", function () { audio.pause(); });
      navigator.mediaSession.setActionHandler("seekbackward", function () { applySeek(audio.currentTime - 10); });
      navigator.mediaSession.setActionHandler("seekforward", function () { applySeek(audio.currentTime + 30); });
      navigator.mediaSession.setActionHandler("seekto", function (d) {
        if (d && d.seekTime != null) applySeek(d.seekTime);
      });
    } catch (e) {}
  }

  window.addEventListener("pagehide", function () {
    if (started) save(audio.currentTime);
  });

  /* ---------- 初期化 ---------- */
  durEl.textContent = duration ? fmt(duration) : "--:--";
  if (duration) seek.max = Math.floor(duration);
  paintSeek();

  var savedRate = parseFloat(function () {
    try { return localStorage.getItem(RATE_KEY); } catch (e) { return ""; }
  }());
  setRate(RATES.indexOf(savedRate) >= 0 ? savedRate : 1);

  // 頭出し: URLの ?t=/#t= が最優先、なければ「前回のつづき」
  function parseTimeParam() {
    var m = (location.search + " " + location.hash).match(/[?&#]t=(\d+(?::\d+){0,2})(?:$|[&\s])/);
    if (!m) return null;
    var sec = 0;
    m[1].split(":").forEach(function (p) { sec = sec * 60 + (parseInt(p, 10) || 0); });
    return sec > 0 ? sec : null;
  }
  var tParam = parseTimeParam();
  var resumeT = loadSaved();
  if (tParam != null) {
    applySeek(tParam);
    note("🎯 <strong>" + fmt(tParam) + "</strong> の話題から再生します（始まらないときは再生ボタンを押してください）");
    play();
  } else if (resumeT != null) {
    applySeek(resumeT);
    note("⏯ 前回のつづき <strong>" + fmt(resumeT) + "</strong> から再生できます", true);
  }
})();
