// onboard.tsx — first-run empty-state card: what this is + a primary CTA and an
// optional secondary link. Used by the builds and reports list pages.

export function Onboard(
  { title, body, primary, secondary }: {
    title: string;
    body: string;
    primary: { href: string; label: string };
    secondary?: { href: string; label: string };
  },
) {
  return (
    <div class="onboard">
      <h2>{title}</h2>
      <p>{body}</p>
      <div class="onboard-cta">
        <a class="btn" href={primary.href}>{primary.label}</a>
        {secondary
          ? <a href={secondary.href} class="onboard-secondary">{secondary.label}</a>
          : null}
      </div>
    </div>
  );
}
