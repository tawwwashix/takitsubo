/* One audio element per document; page controls are disposable views of it. */
(function () {
  "use strict";
  var audio = document.createElement("audio");
  audio.id = "tkAudio";
  audio.preload = "none";
  audio.hidden = true;
  document.body.appendChild(audio);
  var active = null, view = null, started = false, pendingSeek = null, lastSave = 0;
  var RATES = [1, 1.2, 1.5, 1.7, 2, 0.8];
  var rate = parseFloat(read("tkrate"));
  if (RATES.indexOf(rate) < 0) rate = 1;
  audio.playbackRate = rate;
  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function track(name, params) { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); }
  function fmt(s) {
    s = Math.max(0, Math.round(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, "0");
    return h ? h + ":" + String(m).padStart(2, "0") + ":" + ss : m + ":" + ss;
  }
  function duration() { return Number.isFinite(audio.duration) ? audio.duration : (active ? active.duration : 0); }
  function time() { return pendingSeek != null ? pendingSeek : audio.currentTime; }
  function matching() { return active && view && active.ep === view.ep; }
  function save() {
    if (!active || !started) return;
    var t = time(), d = duration();
    try {
      if (t < 20 || (d && t > d - 45)) localStorage.removeItem("tkpos:" + active.ep);
      else localStorage.setItem("tkpos:" + active.ep, JSON.stringify({ t: Math.floor(t), ts: Date.now() }));
    } catch (e) {}
  }
  function resume(ep, d) {
    try { var v = JSON.parse(read("tkpos:" + ep)); return v && v.t > 20 && (!d || v.t < d - 45) ? v.t : 0; } catch (e) { return 0; }
  }
  function timeParam() {
    var m = (location.search + " " + location.hash).match(/[?&#]t=(\d+(?::\d+){0,2})(?:$|[&\s])/);
    return m ? m[1].split(":").reduce(function (n, p) { return n * 60 + Number(p); }, 0) : null;
  }
  function seekTo(t) {
    var d = duration(); t = Math.max(0, d ? Math.min(t, Math.max(0, d - 0.5)) : t);
    if (audio.readyState >= 1) { pendingSeek = null; audio.currentTime = t; }
    else { pendingSeek = t; audio.load(); }
    render();
  }
  function play() {
    var p = audio.play();
    if (p) p.catch(function (error) { if (error.name !== "AbortError" && error.name !== "NotAllowedError") showError(); });
  }
  function toggle() { if (audio.paused) play(); else audio.pause(); }
  function cycleRate() {
    rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; audio.playbackRate = rate;
    try { localStorage.setItem("tkrate", String(rate)); } catch (e) {}
    render();
  }
  function select(v) {
    if (active && active.ep === v.ep) return;
    save(); audio.pause();
    active = { ep: v.ep, title: v.title, url: v.url, duration: v.duration };
    started = false; pendingSeek = v.start || null;
    audio.src = v.src; audio.playbackRate = rate;
    miniLink.href = active.url;
    miniLink.title = active.title + " の再生ページへ";
    if ("mediaSession" in navigator) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: v.title, artist: v.show,
        artwork: v.image ? [{ src: v.image, sizes: "800x800", type: "image/jpeg" }] : [] }); } catch (e) {}
    }
    render();
  }
  function note(v, message, restart) {
    var el = v.box.querySelector(".tkp-note"); el.textContent = message; el.hidden = false;
    if (restart) {
      var button = document.createElement("button");
      button.type = "button"; button.className = "tkp-restart"; button.textContent = "最初から聴く";
      button.addEventListener("click", function () {
        select(v); seekTo(0); v.start = 0; el.hidden = true;
        try { localStorage.removeItem("tkpos:" + v.ep); } catch (e) {}
      });
      el.appendChild(button);
    }
  }
  function showError() {
    miniMessage.textContent = "音声を読み込めませんでした。再生ボタンで再試行できます。";
    if (matching()) note(view, "⚠ 音声を読み込めませんでした。通信状況をご確認いただくか、各配信サービスからお聴きください。");
  }
  function paint(input, t, d) {
    input.max = Math.floor(d || 1); input.value = Math.floor(t);
    var pct = Math.min(100, t / (d || 1) * 100);
    input.style.background = "linear-gradient(90deg, var(--primary) " + pct + "%, var(--line) " + pct + "%)";
  }
  function render() {
    var t = time(), d = duration(), same = matching();
    if (view) {
      var vt = same ? t : view.start, vd = same ? d : view.duration;
      view.box.classList.toggle("playing", !!same && !audio.paused);
      view.play.setAttribute("aria-label", same && !audio.paused ? "一時停止" : "この回を再生");
      view.box.querySelector(".tkp-rate").textContent = rate.toFixed(1) + "x";
      view.box.querySelector(".tkp-dur").textContent = vd ? fmt(vd) : "--:--";
      if (!view.dragging) { view.box.querySelector(".tkp-cur").textContent = fmt(vt); paint(view.seek, vt, vd); }
      var index = -1;
      if (same && (started || t > 0)) view.chapters.forEach(function (row, i) { if (t >= Number(row.dataset.t) - 0.5) index = i; });
      view.chapters.forEach(function (row, i) { row.parentElement.classList.toggle("now", i === index); });
    }
    var visible = !!active && started && (!same || !view.visible);
    mini.classList.toggle("show", visible);
    document.body.classList.toggle("has-mini-player", visible);
    mini.classList.toggle("playing", !!active && !audio.paused);
    miniPlay.setAttribute("aria-label", audio.paused ? "再生" : "一時停止");
    miniLink.textContent = active ? active.title : "";
    miniTime.textContent = fmt(t) + " / " + (d ? fmt(d) : "--:--");
    miniRate.textContent = rate.toFixed(1) + "x";
    if (!miniDragging) paint(miniSeek, t, d);
  }
  var mini = document.createElement("section");
  mini.className = "tk-mini"; mini.setAttribute("aria-label", "再生中のエピソード");
  mini.innerHTML = '<button class="tk-mini-play" type="button" aria-label="再生">' +
    '<svg class="i-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72L19 12 8 5.14z"/></svg>' +
    '<svg class="i-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.6v14H7V5zm6.4 0H17v14h-3.6V5z"/></svg></button>' +
    '<div class="tk-mini-body"><a class="tk-mini-title"></a><input class="tkp-seek tk-mini-seek" type="range" min="0" max="1" value="0" aria-label="再生位置">' +
    '<span class="tk-mini-time"></span><span class="tk-mini-message" role="status"></span></div>' +
    '<button class="tkp-btn tk-mini-back" type="button" aria-label="10秒戻る">−10秒</button>' +
    '<button class="tkp-btn tk-mini-fwd" type="button" aria-label="30秒進む">+30秒</button>' +
    '<button class="tkp-btn tk-mini-rate" type="button" aria-label="再生速度を変える">1.0x</button>';
  document.body.appendChild(mini);
  var miniPlay = mini.querySelector(".tk-mini-play"), miniLink = mini.querySelector("a");
  var miniTime = mini.querySelector(".tk-mini-time"), miniSeek = mini.querySelector("input"), miniRate = mini.querySelector(".tk-mini-rate");
  var miniMessage = mini.querySelector(".tk-mini-message"), miniDragging = false;
  miniPlay.addEventListener("click", toggle); miniRate.addEventListener("click", cycleRate);
  mini.querySelector(".tk-mini-back").addEventListener("click", function () { seekTo(time() - 10); });
  mini.querySelector(".tk-mini-fwd").addEventListener("click", function () { seekTo(time() + 30); });
  miniSeek.addEventListener("input", function () { miniDragging = true; miniTime.textContent = fmt(Number(miniSeek.value)); });
  miniSeek.addEventListener("change", function () { miniDragging = false; seekTo(Number(miniSeek.value)); });
  audio.addEventListener("loadedmetadata", function () {
    if (pendingSeek != null) { audio.currentTime = Math.min(pendingSeek, Math.max(0, duration() - 0.5)); pendingSeek = null; }
    render();
  });
  audio.addEventListener("timeupdate", function () {
    render(); if (!audio.paused && Date.now() - lastSave > 5000) { lastSave = Date.now(); save(); }
  });
  audio.addEventListener("play", function () {
    if (!started) { started = true; track("player_play", { ep: active.ep }); }
    miniMessage.textContent = ""; render();
  });
  audio.addEventListener("pause", function () { save(); render(); });
  audio.addEventListener("ended", function () {
    try { localStorage.removeItem("tkpos:" + active.ep); } catch (e) {}
    track("player_complete", { ep: active.ep }); render();
  });
  audio.addEventListener("error", showError);
  window.addEventListener("pagehide", save);
  if ("mediaSession" in navigator) {
    var handlers = { play: play, pause: function () { audio.pause(); }, seekbackward: function () { seekTo(time() - 10); },
      seekforward: function () { seekTo(time() + 30); }, seekto: function (event) { if (event.seekTime != null) seekTo(event.seekTime); } };
    Object.keys(handlers).forEach(function (name) { try { navigator.mediaSession.setActionHandler(name, handlers[name]); } catch (e) {} });
  }
  var firstPage = true;
  window.Takitsubo.register(function (page) {
    var box = document.getElementById("tkPlayer"), initial = firstPage; firstPage = false; view = null;
    if (!box) { render(); return; }
    var v = view = { box: box, ep: box.dataset.ep, title: box.dataset.title, show: box.dataset.show,
      duration: Number(box.dataset.duration) || 0, src: new URL(box.dataset.audio, location.href).href,
      image: box.dataset.image ? new URL(box.dataset.image, location.href).href : "", url: location.origin + location.pathname,
      play: box.querySelector(".tkp-play"), seek: box.querySelector(".tkp-seek"),
      chapters: Array.from(document.querySelectorAll(".chap-row[data-t]")), visible: true, dragging: false };
    var param = timeParam(); v.start = param != null ? param : resume(v.ep, v.duration);
    if (!matching() && v.start) note(v, (param != null ? "🎯 " : "⏯ 前回のつづき ") + fmt(v.start) + " から再生できます", param == null);
    v.play.addEventListener("click", function () { select(v); toggle(); });
    v.seek.addEventListener("input", function () { v.dragging = true; box.querySelector(".tkp-cur").textContent = fmt(Number(v.seek.value)); });
    v.seek.addEventListener("change", function () { var t = Number(v.seek.value); v.dragging = false; select(v); seekTo(t); });
    box.querySelector(".tkp-back").addEventListener("click", function () { select(v); seekTo(time() - 10); });
    box.querySelector(".tkp-fwd").addEventListener("click", function () { select(v); seekTo(time() + 30); });
    box.querySelector(".tkp-rate").addEventListener("click", cycleRate);
    v.chapters.forEach(function (row) { row.addEventListener("click", function () {
      select(v); seekTo(Number(row.dataset.t)); play(); track("player_chapter", { ep: v.ep, t: Number(row.dataset.t) });
    }); });
    var copy = box.querySelector(".tkp-copy");
    if (copy) copy.addEventListener("click", function () {
      var t = Math.floor(matching() ? time() : v.start), url = v.url + (t > 0 ? "?t=" + t : ""), label = copy.innerHTML;
      function done() {
        if (page.signal.aborted) return;
        copy.textContent = "✅ コピーしました！";
        var timer = setTimeout(function () { copy.innerHTML = label; }, 1800);
        page.onDispose(function () { clearTimeout(timer); });
      }
      function fallback() {
        if (page.signal.aborted) return;
        var ta = document.createElement("textarea"); ta.value = url; document.body.appendChild(ta); ta.select();
        var success = false; try { success = document.execCommand("copy"); } catch (e) {}
        ta.remove(); if (success) done();
      }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
      track("player_copy_link", { ep: v.ep, t: t });
    });
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) { v.visible = entries[0].isIntersecting; render(); }, { rootMargin: "-56px 0px 0px 0px" });
      observer.observe(box); page.onDispose(function () { observer.disconnect(); });
    } else v.visible = false;
    page.onDispose(function () { view = null; });
    // Only a direct timestamp URL auto-selects; internal navigation never changes the audio.
    if (initial && param != null) { select(v); play(); }
    render();
  });
})();
