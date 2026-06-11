// draft_autosave.ts — the app's only client-side JS: autosave the build form to
// localStorage so a killed tab / crash mid-entry doesn't lose 100+ fields.
//
// Vanilla, no framework, no build step. Served as an inline <script> by the
// DraftAutosave component (see builds.tsx). UI strings come from
// window.__draftI18n (set by the server so the banner is translatable).
//
// Behavior: debounced save on input → localStorage, keyed by the form's action
// path (so new / edit / per-build drafts don't collide). On submit the draft is
// cleared. On load, if a draft exists, a non-destructive banner offers
// Restore / Discard — it never silently clobbers the server-prefilled values.

export const AUTOSAVE_JS = `
(function () {
  var form = document.querySelector('form[method="post"][action*="/builds"]');
  if (!form || !window.localStorage) return;
  var i18n = window.__draftI18n || { prompt: "Unsaved draft", restore: "Restore", discard: "Discard" };
  var KEY = "tower:draft:" + new URL(form.action).pathname;

  function controls() {
    return Array.prototype.filter.call(
      form.querySelectorAll("input[name], select[name], textarea[name]"),
      function (el) { return el.type !== "hidden" && el.type !== "submit"; }
    );
  }
  function serialize() {
    var data = {};
    controls().forEach(function (el) {
      data[el.name] = el.type === "checkbox" ? (el.checked ? "on" : "") : el.value;
    });
    return data;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data: serialize() })); } catch (e) {}
  }
  var timer;
  form.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(save, 500); });
  form.addEventListener("submit", function () { try { localStorage.removeItem(KEY); } catch (e) {} });

  var raw;
  try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
  if (!raw) return;
  var draft;
  try { draft = JSON.parse(raw); } catch (e) { return; }
  if (!draft || !draft.data) return;

  var bar = document.createElement("div");
  bar.setAttribute("role", "status");
  bar.style.cssText = "border:1px solid var(--accent);border-radius:6px;padding:.6rem .75rem;margin-bottom:1rem;display:flex;gap:.75rem;align-items:center;flex-wrap:wrap";
  var msg = document.createElement("span");
  msg.className = "hint";
  msg.textContent = i18n.prompt;
  var restore = document.createElement("button");
  restore.type = "button";
  restore.textContent = i18n.restore;
  var discard = document.createElement("button");
  discard.type = "button";
  discard.textContent = i18n.discard;
  discard.style.background = "transparent";
  discard.style.color = "var(--muted)";
  bar.appendChild(msg);
  bar.appendChild(restore);
  bar.appendChild(discard);
  form.insertBefore(bar, form.firstChild);

  restore.addEventListener("click", function () {
    Object.keys(draft.data).forEach(function (name) {
      var el = form.querySelector('[name="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]');
      if (!el) return;
      if (el.type === "checkbox") el.checked = draft.data[name] === "on";
      else el.value = draft.data[name];
      if (draft.data[name]) {
        var sec = el.closest("details.section");
        if (sec) sec.open = true;
      }
    });
    bar.remove();
  });
  discard.addEventListener("click", function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    bar.remove();
  });
})();
`;
