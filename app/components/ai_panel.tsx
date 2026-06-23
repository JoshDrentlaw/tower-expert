// ai_panel.tsx — bring-your-own-key AI analysis widget, shared by the build and
// run detail pages. Both the key form and the analyze controls render
// server-side; ai_analyze.ts toggles between them based on whether a key is in
// this browser's localStorage, renders the model's markdown SAFELY (DOM-built,
// never innerHTML — the key lives in localStorage, so an HTML sink over model
// output would be a key-exfiltration bug), and wires copy-as-markdown /
// copy-as-text. Config + strings ride on window.__ai / window.__aiI18n; JSON is
// `<`-escaped so nothing can break out of the <script>.

import type { RequestContext } from "../services/ctx.ts";
import { AI_ANALYZE_JS } from "./ai_analyze.ts";
import { AI_MODELS, DEFAULT_MODEL } from "../services/ai.ts";

export function AiAnalyze(
  { ctx, kind, id }: { ctx: RequestContext; kind: "build" | "run"; id: number },
) {
  const { base, t } = ctx;
  const esc = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
  const runLabel = kind === "run"
    ? t("ai.analyzeRun", { default: "Analyze this run" })
    : t("ai.analyzeBuild", { default: "Analyze this build" });
  const cfg = esc({ endpoint: `${base}/ai/analyze`, kind, id, defaultModel: DEFAULT_MODEL });
  const i18n = esc({
    usingKey: t("ai.usingKey", { default: "Using key" }),
    keyRequired: t("ai.keyRequired", { default: "Enter a key." }),
    storeFailed: t("ai.storeFailed", { default: "Couldn't store the key in this browser." }),
    run: runLabel,
    analyzing: t("ai.analyzing", { default: "Analyzing…" }),
    working: t("ai.working", { default: "Analyzing — this can take up to a minute." }),
    copyMarkdown: t("ai.copyMarkdown", { default: "Copy markdown" }),
    copyText: t("ai.copyText", { default: "Copy as text" }),
    copied: t("ai.copied", { default: "Copied" }),
    copyFailed: t("ai.copyFailed", { default: "Copy failed" }),
    genericError: t("ai.error.generic", { default: "Analysis failed. Try again." }),
    networkError: t("ai.error.network", { default: "Couldn't reach the server. Try again." }),
  });
  return (
    <section class="ai-panel" data-ai-panel aria-labelledby="ai-h">
      <h3 id="ai-h" class="ai-h">{t("ai.heading", { default: "AI analysis" })}</h3>
      <noscript>
        <p class="hint">{t("ai.noscript", { default: "AI analysis needs JavaScript enabled." })}</p>
      </noscript>
      <div data-ai-keyform hidden>
        <p class="hint">
          {t("ai.keyIntro", {
            default:
              "Bring your own Anthropic API key. It's stored only in this browser and forwarded to Anthropic for one request at a time — never saved on this site.",
          })}
        </p>
        <div class="ai-keyrow">
          <input
            type="password"
            data-ai-keyinput
            autocomplete="off"
            spellcheck={false}
            placeholder="sk-ant-…"
            aria-label={t("ai.keyLabel", { default: "Anthropic API key" })}
          />
          <button type="button" data-ai-save>{t("ai.saveKey", { default: "Save key" })}</button>
        </div>
        <p class="hint ai-err" data-ai-keyerror role="alert"></p>
      </div>
      <div data-ai-ready hidden>
        <div class="ai-controls">
          <button type="button" data-ai-run>{runLabel}</button>
          <select data-ai-model aria-label={t("ai.modelLabel", { default: "Model" })}>
            {AI_MODELS.map((m) => <option value={m.id}>{m.label}</option>)}
          </select>
          <button type="button" class="ai-link" data-ai-forget>
            {t("ai.forgetKey", { default: "Forget key" })}
          </button>
          <span class="hint" data-ai-keyhint></span>
        </div>
        <div class="ai-output ai-md" data-ai-output aria-live="polite"></div>
        <div class="ai-result-actions" data-ai-actions hidden>
          <button type="button" class="ai-link" data-ai-copy-md>
            {t("ai.copyMarkdown", { default: "Copy markdown" })}
          </button>
          <button type="button" class="ai-link" data-ai-copy-txt>
            {t("ai.copyText", { default: "Copy as text" })}
          </button>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `window.__ai=${cfg};window.__aiI18n=${i18n};` }} />
      <script dangerouslySetInnerHTML={{ __html: AI_ANALYZE_JS }} />
    </section>
  );
}
