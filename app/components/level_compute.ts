// level_compute.ts — client JS for the live level→value preview on the build
// form. A level input carries data-formula='{"base","increment","maxLevel"}',
// data-target (the id of the value input to fill) and data-unit. On input it
// computes value = base + increment*level (clamped) and writes the formatted
// value into the target field, then re-dispatches `input` so the draft-autosave
// and changed-highlight scripts see the update. The server recomputes the value
// authoritatively on save (app/stat_formula.ts), so this is preview-only.
//
// Also wires the "Max" buttons: a per-field button (data-max="<level input id>")
// fills that one stat to its max level; a section button (data-max-section)
// fills every formula field in its <details> section. Both reuse compute().

export const LEVEL_COMPUTE_JS = `
(function () {
  function trim(n) { return Number(n.toFixed(6)).toString(); }
  function fmt(n, unit) {
    if (unit === "mult") return "\\u00d7" + trim(n);
    if (unit === "pct") return trim(n) + "%";
    if (unit === "sec") return trim(n) + "s";
    return trim(n);
  }
  function compute(el) {
    var spec;
    try { spec = JSON.parse(el.getAttribute("data-formula")); } catch (e) { return; }
    var target = document.getElementById(el.getAttribute("data-target"));
    if (!target) return;
    var raw = el.value.trim();
    if (raw === "") return; // empty level: leave the value field for manual entry
    if (!/^\\d+$/.test(raw)) return; // wait for a clean non-negative integer
    var lvl = parseInt(raw, 10);
    if (lvl > spec.maxLevel) { lvl = spec.maxLevel; el.value = String(lvl); }
    target.value = fmt(spec.base + spec.increment * lvl, el.getAttribute("data-unit") || "num");
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function setMax(el) {
    var spec;
    try { spec = JSON.parse(el.getAttribute("data-formula")); } catch (e) { return; }
    el.value = String(spec.maxLevel);
    compute(el);
  }
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el && el.hasAttribute && el.hasAttribute("data-formula")) compute(el);
  });
  document.addEventListener("click", function (e) {
    var btn = e.target;
    if (!btn || !btn.getAttribute) return;
    if (btn.hasAttribute("data-max")) {
      var lvl = document.getElementById(btn.getAttribute("data-max"));
      if (lvl) setMax(lvl);
    } else if (btn.hasAttribute("data-max-section")) {
      var sec = btn.closest("details.section") || document;
      var inputs = sec.querySelectorAll("[data-formula]");
      Array.prototype.forEach.call(inputs, setMax);
    }
  });
})();
`;
