// ai_analyze.ts — client-side AI analysis widget for the build & run detail
// pages.
//
// Bring-your-own-key, stored client-side ONLY: the Anthropic key lives in this
// browser's localStorage and is sent (in the x-anthropic-key header) on each
// analyze request, never persisted on the server. The feature is gated on the
// key's presence — no key, no analysis.
//
// The model returns markdown. We render it by BUILDING DOM NODES with
// textContent — never assigning innerHTML. This is load-bearing for security:
// the API key is in localStorage, so any HTML sink over (model-influenced)
// output would be a key-exfiltration vector. With textContent-only rendering,
// any markup in the model's text becomes literal characters, never executes.
//
// Vanilla, no framework, no build step (the app's house style). Config + UI
// strings arrive via window.__ai / window.__aiI18n; the widget DOM is
// server-rendered (see AiAnalyze in ai_panel.tsx); this script wires it.

export const AI_ANALYZE_JS = `
(function () {
  var cfg = window.__ai;
  var i18n = window.__aiI18n || {};
  var root = document.querySelector("[data-ai-panel]");
  if (!cfg || !root || !window.localStorage) return;

  var KEY = "tower:ai:key";
  var MODEL_KEY = "tower:ai:model";
  var GOAL_KEY = "tower:ai:goal";
  var keyForm = root.querySelector("[data-ai-keyform]");
  var ready = root.querySelector("[data-ai-ready]");
  var keyInput = root.querySelector("[data-ai-keyinput]");
  var saveBtn = root.querySelector("[data-ai-save]");
  var runBtn = root.querySelector("[data-ai-run]");
  var forgetBtn = root.querySelector("[data-ai-forget]");
  var modelSel = root.querySelector("[data-ai-model]");
  var goalSel = root.querySelector("[data-ai-goal]");
  var questionEl = root.querySelector("[data-ai-question]");
  var keyHint = root.querySelector("[data-ai-keyhint]");
  var output = root.querySelector("[data-ai-output]");
  var saveErr = root.querySelector("[data-ai-keyerror]");
  var actions = root.querySelector("[data-ai-actions]");
  var copyMdBtn = root.querySelector("[data-ai-copy-md]");
  var copyTxtBtn = root.querySelector("[data-ai-copy-txt]");

  var lastMarkdown = "";

  function getKey() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function mask(k) {
    return k && k.length > 8 ? "sk-…" + k.slice(-4) : "key set";
  }
  function render() {
    var k = getKey();
    if (k) {
      if (keyForm) keyForm.hidden = true;
      if (ready) ready.hidden = false;
      if (keyHint) keyHint.textContent = (i18n.usingKey || "Using key") + " " + mask(k);
    } else {
      if (keyForm) keyForm.hidden = false;
      if (ready) ready.hidden = true;
    }
  }

  // --- Safe markdown -> DOM (textContent only; no innerHTML anywhere) ---------
  function inline(text, parent) {
    // code | **bold** | *italic* | [text](url). Underscores are intentionally
    // not emphasis markers (they collide with stat identifiers).
    var re = /(\`([^\`]+)\`)|(\\*\\*([^*]+)\\*\\*)|(\\*([^*\\n]+)\\*)|(\\[([^\\]]+)\\]\\(([^)\\s]+)\\))/;
    var rest = text;
    while (rest.length) {
      var m = re.exec(rest);
      if (!m) { parent.appendChild(document.createTextNode(rest)); break; }
      if (m.index > 0) parent.appendChild(document.createTextNode(rest.slice(0, m.index)));
      if (m[2] != null) {
        var c = document.createElement("code"); c.textContent = m[2]; parent.appendChild(c);
      } else if (m[4] != null) {
        var b = document.createElement("strong"); inline(m[4], b); parent.appendChild(b);
      } else if (m[6] != null) {
        var em = document.createElement("em"); inline(m[6], em); parent.appendChild(em);
      } else if (m[8] != null) {
        var url = m[9];
        if (/^(https?:\\/\\/|mailto:)/i.test(url)) {
          var a = document.createElement("a");
          a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
          a.textContent = m[8]; parent.appendChild(a);
        } else {
          parent.appendChild(document.createTextNode(m[8]));
        }
      }
      rest = rest.slice(m.index + m[0].length);
    }
  }

  function renderMarkdown(container, md) {
    container.textContent = "";
    var lines = String(md).replace(/\\r\\n/g, "\\n").split("\\n");
    var i = 0, para = [], list = null, listOrdered = false;
    function flushPara() {
      if (para.length) {
        var p = document.createElement("p"); inline(para.join(" "), p);
        container.appendChild(p); para = [];
      }
    }
    function flushList() { if (list) { container.appendChild(list); list = null; } }
    while (i < lines.length) {
      var line = lines[i];
      if (/^\\s*\`\`\`/.test(line)) {
        flushPara(); flushList();
        var buf = []; i++;
        while (i < lines.length && !/^\\s*\`\`\`/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        var pre = document.createElement("pre"); var code = document.createElement("code");
        code.textContent = buf.join("\\n"); pre.appendChild(code); container.appendChild(pre);
        continue;
      }
      if (/^\\s*$/.test(line)) { flushPara(); flushList(); i++; continue; }
      var h = /^(#{1,6})\\s+(.*)$/.exec(line);
      if (h) {
        flushPara(); flushList();
        var lvl = Math.min(h[1].length + 3, 6); // page already uses h1–h3
        var el = document.createElement("h" + lvl); inline(h[2], el); container.appendChild(el);
        i++; continue;
      }
      var li = /^\\s*([-*]|\\d+\\.)\\s+(.*)$/.exec(line);
      if (li) {
        flushPara();
        var ordered = /\\d/.test(li[1]);
        if (!list || listOrdered !== ordered) {
          flushList(); list = document.createElement(ordered ? "ol" : "ul"); listOrdered = ordered;
        }
        var item = document.createElement("li"); inline(li[2], item); list.appendChild(item);
        i++; continue;
      }
      flushList(); para.push(line); i++;
    }
    flushPara(); flushList();
  }

  function showActions(on) { if (actions) actions.hidden = !on; }
  function status(msg, isErr) {
    showActions(false);
    if (!output) return;
    output.textContent = "";
    if (isErr) output.classList.add("ai-err"); else output.classList.remove("ai-err");
    output.appendChild(document.createTextNode(msg));
  }

  // Restore the last-chosen model if it's still one the server offers.
  if (modelSel) {
    var saved;
    try { saved = localStorage.getItem(MODEL_KEY); } catch (e) { saved = null; }
    if (saved) {
      for (var mi = 0; mi < modelSel.options.length; mi++) {
        if (modelSel.options[mi].value === saved) { modelSel.value = saved; break; }
      }
    }
    modelSel.addEventListener("change", function () {
      try { localStorage.setItem(MODEL_KEY, modelSel.value); } catch (e) {}
    });
  }

  // Persist the goal choice too (the question is per-analysis, so it isn't).
  if (goalSel) {
    var savedGoal;
    try { savedGoal = localStorage.getItem(GOAL_KEY); } catch (e) { savedGoal = null; }
    if (savedGoal) {
      for (var gi = 0; gi < goalSel.options.length; gi++) {
        if (goalSel.options[gi].value === savedGoal) { goalSel.value = savedGoal; break; }
      }
    }
    goalSel.addEventListener("change", function () {
      try { localStorage.setItem(GOAL_KEY, goalSel.value); } catch (e) {}
    });
  }

  if (saveBtn && keyInput) {
    saveBtn.addEventListener("click", function () {
      var v = (keyInput.value || "").trim();
      if (saveErr) saveErr.textContent = "";
      if (!v) { if (saveErr) saveErr.textContent = i18n.keyRequired || "Enter a key."; return; }
      try {
        localStorage.setItem(KEY, v);
      } catch (e) {
        if (saveErr) saveErr.textContent = i18n.storeFailed || "Couldn't store the key in this browser.";
        return;
      }
      keyInput.value = "";
      render();
    });
  }

  if (forgetBtn) {
    forgetBtn.addEventListener("click", function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      lastMarkdown = "";
      if (output) output.textContent = "";
      showActions(false);
      render();
    });
  }

  function flash(btn, msg) {
    if (!btn) return;
    var prev = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = prev; }, 1200);
  }
  function copy(text, btn) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      flash(btn, i18n.copyFailed || "Copy failed");
      return;
    }
    navigator.clipboard.writeText(text).then(function () {
      flash(btn, i18n.copied || "Copied");
    }, function () {
      flash(btn, i18n.copyFailed || "Copy failed");
    });
  }
  if (copyMdBtn) {
    copyMdBtn.addEventListener("click", function () { copy(lastMarkdown, copyMdBtn); });
  }
  if (copyTxtBtn) {
    copyTxtBtn.addEventListener("click", function () {
      copy(output ? (output.innerText || output.textContent || "") : "", copyTxtBtn);
    });
  }

  function setBusy(busy) {
    if (runBtn) {
      runBtn.disabled = busy;
      runBtn.textContent = busy ? (i18n.analyzing || "Analyzing…") : (i18n.run || "Analyze");
    }
  }

  if (runBtn) {
    setBusy(false);
    runBtn.addEventListener("click", function () {
      var k = getKey();
      if (!k) { render(); return; }
      setBusy(true);
      status(i18n.working || "Analyzing — this can take up to a minute.", false);
      fetch(cfg.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-anthropic-key": k },
        body: JSON.stringify({
          kind: cfg.kind,
          id: cfg.id,
          model: modelSel ? modelSel.value : cfg.defaultModel,
          goal: goalSel ? goalSel.value : "auto",
          question: questionEl ? (questionEl.value || "").trim() : "",
        }),
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
      }).then(function (res) {
        setBusy(false);
        if (!res.ok) {
          status((res.body && res.body.error) || (i18n.genericError || "Analysis failed."), true);
          if (res.status === 401) render(); // a rejected key is worth re-prompting for
          return;
        }
        lastMarkdown = (res.body && res.body.text) || "";
        if (output) {
          output.classList.remove("ai-err");
          renderMarkdown(output, lastMarkdown);
        }
        showActions(!!lastMarkdown);
      }).catch(function () {
        setBusy(false);
        status(i18n.networkError || "Couldn't reach the server. Try again.", true);
      });
    });
  }

  render();
})();
`;
