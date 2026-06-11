// changed_highlight.ts — client JS that highlights fields you've changed from
// their loaded value, on a prefilled build form (edit / respec). Records each
// control's initial value on load, then on input toggles a `.changed` class and
// opens the field's collapsed section. Only runs when the form carries
// data-highlight-changes (set by the server for edit/respec, not blank/new).

export const HIGHLIGHT_JS = `
(function () {
  var form = document.querySelector('form[method="post"][action*="/builds"][data-highlight-changes]');
  if (!form) return;
  function val(el) { return el.type === "checkbox" ? (el.checked ? "1" : "") : el.value; }
  function tracked(el) { return el.name && el.type !== "hidden" && el.type !== "submit"; }
  var initial = {};
  Array.prototype.forEach.call(
    form.querySelectorAll("input[name], select[name], textarea[name]"),
    function (el) { if (tracked(el)) initial[el.name] = val(el); }
  );
  function update(el) {
    if (!el || !tracked(el) || !(el.name in initial)) return;
    var changed = val(el) !== initial[el.name];
    el.classList.toggle("changed", changed);
    if (changed) {
      var sec = el.closest("details.section");
      if (sec) sec.open = true;
    }
  }
  form.addEventListener("input", function (e) { update(e.target); });
  form.addEventListener("change", function (e) { update(e.target); });
})();
`;
