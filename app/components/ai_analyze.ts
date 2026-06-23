// ai_analyze.ts — client-side AI analysis widget for the build detail page.
//
// Bring-your-own-key, stored client-side ONLY: the Anthropic key lives in this
// browser's localStorage and is sent (in the x-anthropic-key header) on each
// analyze request, never persisted on the server. The feature is gated on the
// key's presence — no key, no analysis.
//
// Vanilla, no framework, no build step (the app's house style). Config + UI
// strings arrive via window.__ai / window.__aiI18n, set by the server so the
// model list and copy stay server-owned and translatable. The widget's DOM is
// server-rendered (see AiAnalyze in builds.tsx); this script only wires it.

export const AI_ANALYZE_JS = `
(function () {
  var cfg = window.__ai;
  var i18n = window.__aiI18n || {};
  var root = document.querySelector("[data-ai-panel]");
  if (!cfg || !root || !window.localStorage) return;

  var KEY = "tower:ai:key";
  var MODEL_KEY = "tower:ai:model";
  var keyForm = root.querySelector("[data-ai-keyform]");
  var ready = root.querySelector("[data-ai-ready]");
  var keyInput = root.querySelector("[data-ai-keyinput]");
  var saveBtn = root.querySelector("[data-ai-save]");
  var runBtn = root.querySelector("[data-ai-run]");
  var forgetBtn = root.querySelector("[data-ai-forget]");
  var modelSel = root.querySelector("[data-ai-model]");
  var keyHint = root.querySelector("[data-ai-keyhint]");
  var output = root.querySelector("[data-ai-output]");
  var saveErr = root.querySelector("[data-ai-keyerror]");

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

  // Restore the last-chosen model if it's still one the server offers.
  if (modelSel) {
    var saved;
    try { saved = localStorage.getItem(MODEL_KEY); } catch (e) { saved = null; }
    if (saved) {
      for (var i = 0; i < modelSel.options.length; i++) {
        if (modelSel.options[i].value === saved) { modelSel.value = saved; break; }
      }
    }
    modelSel.addEventListener("change", function () {
      try { localStorage.setItem(MODEL_KEY, modelSel.value); } catch (e) {}
    });
  }

  if (saveBtn && keyInput) {
    saveBtn.addEventListener("click", function () {
      var v = (keyInput.value || "").trim();
      if (saveErr) saveErr.textContent = "";
      if (!v) {
        if (saveErr) saveErr.textContent = i18n.keyRequired || "Enter a key.";
        return;
      }
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
      if (output) output.textContent = "";
      render();
    });
  }

  function setBusy(busy) {
    if (runBtn) {
      runBtn.disabled = busy;
      runBtn.textContent = busy ? (i18n.analyzing || "Analyzing…") : (i18n.run || "Analyze this build");
    }
  }

  if (runBtn) {
    setBusy(false);
    runBtn.addEventListener("click", function () {
      var k = getKey();
      if (!k) { render(); return; }
      setBusy(true);
      if (output) {
        output.classList.remove("ai-err");
        output.textContent = i18n.working || "Analyzing your build — this can take up to a minute.";
      }
      fetch(cfg.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-anthropic-key": k },
        body: JSON.stringify({
          kind: "build",
          id: cfg.buildId,
          model: modelSel ? modelSel.value : cfg.defaultModel,
        }),
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
      }).then(function (res) {
        setBusy(false);
        if (!res.ok) {
          if (output) {
            output.classList.add("ai-err");
            output.textContent = (res.body && res.body.error) || (i18n.genericError || "Analysis failed.");
          }
          // A rejected key is the one error worth re-prompting for.
          if (res.status === 401) render();
          return;
        }
        if (output) {
          output.classList.remove("ai-err");
          output.textContent = (res.body && res.body.text) || "";
        }
      }).catch(function () {
        setBusy(false);
        if (output) {
          output.classList.add("ai-err");
          output.textContent = i18n.networkError || "Couldn't reach the server. Try again.";
        }
      });
    });
  }

  render();
})();
`;
