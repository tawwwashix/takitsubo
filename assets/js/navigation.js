/* Static pages remain independently usable. Only this shell is replaced;
   the audio engine and its controls live outside it for the document lifetime. */
(function () {
  "use strict";
  var initializers = [], current, request, serial = 0;
  var shell = document.getElementById("sitePage");
  var version = shell.dataset.version;
  var positions = new Map();
  var nextKey = 0, activeKey = null;
  var status = document.createElement("div");
  status.className = "navigation-status visually-hidden";
  status.setAttribute("role", "status");
  document.body.appendChild(status);

  function context() {
    var controller = new AbortController(), cleanups = [];
    return {
      signal: controller.signal,
      onDispose: function (fn) { cleanups.push(fn); },
      listen: function (target, type, fn, options) {
        target.addEventListener(type, fn, options);
        cleanups.push(function () { target.removeEventListener(type, fn, options); });
      },
      dispose: function () { controller.abort(); cleanups.forEach(function (fn) { fn(); }); }
    };
  }
  async function init() {
    current = context();
    await Promise.all(initializers.map(function (fn) { return fn(current); }));
  }
  function remember() {
    if (activeKey != null) positions.set(activeKey, [window.scrollX, window.scrollY]);
  }
  function setKey() {
    history.replaceState(Object.assign({}, history.state, { tkKey: ++nextKey }), "");
    activeKey = nextKey;
  }
  function scrollPage(position, focus) {
    var target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
    if (focus) {
      var heading = shell.querySelector("h1") || shell.querySelector("main");
      if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
    }
    if (position) window.scrollTo({ left: position[0], top: position[1], behavior: "instant" });
    else if (target) target.scrollIntoView({ behavior: "instant" });
    else window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
  function meta(doc) {
    document.title = doc.title;
    document.documentElement.lang = doc.documentElement.lang;
    // Replace page metadata, never the executable scripts or loaded stylesheets.
    var selector = 'meta[name="description"], meta[property], meta[name="twitter:card"], link[rel="canonical"], script[type="application/ld+json"]';
    document.head.querySelectorAll(selector).forEach(function (el) { el.remove(); });
    doc.head.querySelectorAll(selector).forEach(function (el) { document.head.appendChild(el.cloneNode(true)); });
    Array.from(document.body.attributes).forEach(function (a) { document.body.removeAttribute(a.name); });
    Array.from(doc.body.attributes).forEach(function (a) { document.body.setAttribute(a.name, a.value); });
  }
  async function navigate(url, options) {
    options = options || {};
    var id = ++serial;
    if (request) request.abort();
    request = new AbortController();
    var controller = request;
    var timeout = setTimeout(function () { controller.abort(); }, 15000);
    var position = options.pop ? positions.get(history.state && history.state.tkKey) : null;
    if (!options.pop) remember();
    document.documentElement.classList.add("navigating");
    status.textContent = "ページを読み込み中…";
    try {
      var response = await fetch(url.href, { signal: request.signal, headers: { Accept: "text/html" } });
      if (!response.ok || !/text\/html/i.test(response.headers.get("content-type") || "")) throw new Error("Not an HTML page");
      var doc = new DOMParser().parseFromString(await response.text(), "text/html");
      if (id !== serial) return;
      var next = doc.getElementById("sitePage");
      // A deployment with changed code/styles gets a normal load, not mixed versions.
      if (!next || next.dataset.version !== version || !next.querySelector("main") || doc.querySelector("base")) throw new Error("Incompatible page");
      var destination = new URL(response.url);
      if (destination.origin !== location.origin) throw new Error("External redirect");
      destination.hash = url.hash;
      current.dispose();
      meta(doc);
      // Set the URL before inserting relative image/iframe links and initializing data fetches.
      if (options.pop) history.replaceState(history.state, "", destination.href);
      else history.pushState({ tkKey: ++nextKey }, "", destination.href);
      activeKey = history.state && history.state.tkKey;
      shell.replaceWith(next);
      shell = next;
      await Promise.race([
        init(),
        new Promise(function (_, reject) {
          if (controller.signal.aborted) reject(new Error("Navigation cancelled"));
          else controller.signal.addEventListener("abort", function () { reject(new Error("Navigation cancelled")); }, { once: true });
        })
      ]);
      if (id !== serial) return;
      scrollPage(position, !options.pop);
      status.textContent = document.title;
      document.dispatchEvent(new CustomEvent("takitsubo:navigated"));
    } catch (error) {
      if (id === serial) location.assign(url.href);
    } finally {
      clearTimeout(timeout);
      if (id === serial) document.documentElement.classList.remove("navigating");
    }
  }
  window.Takitsubo = {
    register: function (fn) { initializers.push(fn); },
    navigate: function (url) { return navigate(new URL(url, location.href)); }
  };
  document.addEventListener("click", function (event) {
    var a = event.target.closest && event.target.closest("a[href]");
    if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (a.hasAttribute("download") || a.hasAttribute("target") || a.hasAttribute("onclick") || a.closest('[data-no-navigation], [contenteditable="true"]') || a.relList.contains("external")) return;
    var url = new URL(a.href);
    if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin || !/(?:\/|\.html)$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) {
      var target;
      try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch (e) { return; }
      if (!target) return;
      event.preventDefault();
      ++serial;
      if (request) request.abort();
      document.documentElement.classList.remove("navigating");
      remember();
      history.pushState({ tkKey: ++nextKey }, "", url.href);
      activeKey = nextKey;
      scrollPage(null, false);
      return;
    }
    event.preventDefault();
    navigate(url);
  });
  window.addEventListener("popstate", function () {
    navigate(new URL(location.href), { pop: true });
  });
  window.addEventListener("scroll", remember, { passive: true });
  window.addEventListener("pagehide", remember);
  document.addEventListener("DOMContentLoaded", function () {
    setKey();
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    init();
  }, { once: true });
})();
