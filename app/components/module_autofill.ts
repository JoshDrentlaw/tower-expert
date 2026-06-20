// module_autofill.ts — client JS for the module catalog. Reads the catalog from
// window.__moduleCatalog (serialized server-side) and, as a module Name input
// changes, fills its derived block (.mod-main / .mod-uniq) with the chosen
// module's Main Effect stat and Unique Effect — so the player never types them.
// Unknown/custom names clear the block (manual entry). Uses textContent only, so
// catalog text is never interpreted as HTML.

export const MODULE_AUTOFILL_JS = `
(function () {
  var cat = window.__moduleCatalog || [];
  var i18n = window.__moduleI18n || {};
  function find(name) {
    var n = (name || "").trim().toLowerCase();
    if (!n) return null;
    for (var i = 0; i < cat.length; i++) {
      if (cat[i].name.toLowerCase() === n) return cat[i];
    }
    return null;
  }
  function fill(input) {
    var block = document.getElementById(input.getAttribute("data-derived"));
    if (!block) return;
    var mainEl = block.querySelector(".mod-main");
    var uniqEl = block.querySelector(".mod-uniq");
    var m = find(input.value);
    if (mainEl) {
      mainEl.textContent = m && m.mainEffect
        ? ((i18n.mainLabel || "Main effect") + ": " + m.mainEffect) : "";
    }
    if (uniqEl) uniqEl.textContent = m ? m.unique : "";
  }
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el && el.hasAttribute && el.hasAttribute("data-module-name")) fill(el);
  });
})();
`;
