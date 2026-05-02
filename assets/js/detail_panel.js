import { setState } from "./url_state.js";
import { t } from "./i18n.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtNum(n, suffix = "") {
  return (n === null || n === undefined) ? "—" : `${n}${suffix}`;
}

function tierBadge(tier) {
  if (!tier) return "—";
  return `<span class="tier-pill" data-tier="${escapeHtml(tier)}">${escapeHtml(tier)}</span>`;
}

/** Render a list of {id, source?, rationale?, url?} cert references.
 *  `entries` items may be plain strings (legacy successor list) or objects
 *  (new prerequisites form). `extraClass` is appended to the wrapper ul
 *  for source-specific styling (`required` vs `recommended`).               */
function relatedCertList(label, entries, byId, ui, extraClass = "") {
  if (!entries || entries.length === 0) return "";
  const lang = ui.labelLang === "ja" ? "ja" : "en";
  const items = entries.map(entry => {
    const id = typeof entry === "string" ? entry : entry.id;
    const source = typeof entry === "object" ? entry.source : null;
    const rationale = typeof entry === "object" ? entry.rationale : null;
    const sourceUrl = typeof entry === "object" ? entry.url : null;

    const sourceBadge = source
      ? `<span class="src-badge src-${escapeHtml(source)}" title="${escapeHtml(t(`src_${source.replace(/-/g, "_")}_tooltip`, lang))}">${escapeHtml(t(`src_${source.replace(/-/g, "_")}`, lang))}</span>`
      : "";
    const sourceUrlSuffix = sourceUrl
      ? ` <a class="src-evidence" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener" title="${escapeHtml(t("src_evidence", lang))}">↗</a>`
      : "";
    const rationaleHtml = rationale
      ? `<div class="rel-rationale muted">${escapeHtml(rationale)}</div>`
      : "";

    const c = byId.get(id);
    if (!c) {
      return `<li class="missing">
        ${sourceBadge}
        <code>${escapeHtml(id)}</code> ${t("not_in_roadmap", lang)}
        ${sourceUrlSuffix}
        ${rationaleHtml}
      </li>`;
    }
    const name = lang === "ja" ? (c.name_ja || c.name) : c.name;
    return `<li>
      ${sourceBadge}
      <a href="?cert=${encodeURIComponent(id)}" data-cert-link="${escapeHtml(id)}">
        <strong>${escapeHtml(c.abbr)}</strong>
        <span class="muted">${escapeHtml(c.vendor?.name || "")}</span>
        <span class="muted">— ${escapeHtml(name)}</span>
      </a>${sourceUrlSuffix}
      ${rationaleHtml}
    </li>`;
  }).join("");
  const cls = extraClass ? `rel-list ${extraClass}` : "rel-list";
  return `<div class="rel-block"><h4>${escapeHtml(label)}</h4><ul class="${cls}">${items}</ul></div>`;
}

export function renderDetailPanel(panel, cert, byId, ui) {
  // Visibility (`.open` class + aria-hidden) is owned by app.js so the
  // panel content can stay rendered in the DOM even when dismissed.
  if (!cert) {
    panel.innerHTML = "";
    return;
  }

  const lang = ui.labelLang === "ja" ? "ja" : "en";
  const name = lang === "ja" ? (cert.name_ja || cert.name) : cert.name;
  const log = cert.logistics || {};
  const eval_ = cert.evaluation || {};

  // New schema: required_certs (hard, always shown) + recommended_certs
  // (object array with source provenance).
  const requiredEntries = cert.prerequisites?.required_certs || [];
  const recommendedEntries = cert.prerequisites?.recommended_certs || [];

  // Successor search: walk all certs whose required_certs OR recommended_certs
  // reference this cert.id (object form).
  const successorEntries = [];
  for (const [id, c] of byId) {
    const reqs = (c.prerequisites?.required_certs || []).map(e => e.id || e);
    const recs = (c.prerequisites?.recommended_certs || []).map(e => e.id || e);
    if (reqs.includes(cert.id) || recs.includes(cert.id)) {
      successorEntries.push(id);
    }
  }
  successorEntries.sort();

  const factorPlus = (cert.scoring_factors?.plus || []).map(f =>
    `<li><code>${escapeHtml(f.code)}</code> <span class="weight">[${escapeHtml(f.weight_hint)}]</span>${
      f.evidence ? ` — <a href="${escapeHtml(f.evidence)}" target="_blank" rel="noopener">evidence</a>` : ""
    }</li>`).join("");
  const factorMinus = (cert.scoring_factors?.minus || []).map(f =>
    `<li><code>${escapeHtml(f.code)}</code> <span class="weight">[${escapeHtml(f.weight_hint)}]</span>${
      f.evidence ? ` — <a href="${escapeHtml(f.evidence)}" target="_blank" rel="noopener">evidence</a>` : ""
    }</li>`).join("");

  const sources = (cert.sources || []).map(s =>
    `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.url)}</a>
       <span class="muted">[${escapeHtml(s.type)}${s.use ? ", " + escapeHtml(s.use) : ""}]</span></li>`).join("");

  const thirdParty = (cert.third_party_evaluations || []).map(e =>
    `<li><strong>${escapeHtml(e.source_id)}</strong>${
      e.level_hint ? ` → ${escapeHtml(e.level_hint)}` : ""
    } — <a href="${escapeHtml(e.url)}" target="_blank" rel="noopener">link</a>${
      e.summary ? ` <span class="muted">${escapeHtml(e.summary)}</span>` : ""
    }</li>`).join("");

  const personaScores = eval_.persona_scores || {};
  const personasHtml = Object.entries(personaScores).map(([who, p]) =>
    `<li><strong>${escapeHtml(who)}</strong>: ${tierBadge(p.tier)} <span class="muted">${escapeHtml(p.rationale)}</span></li>`
  ).join("");

  const expYrs = cert.prerequisites?.experience_years;

  const availability = cert.availability || "available";
  const availKey = availability === "coming-soon" ? "coming" : availability;
  const availBadge = availability === "available"
    ? ""
    : `<span class="avail-badge avail-${escapeHtml(availability)}">${escapeHtml(t(`avail_${availKey}_badge`, lang))}</span>`;
  const availBanner = availability === "available"
    ? ""
    : `<div class="avail-banner avail-${escapeHtml(availability)}">
         <strong>${escapeHtml(t(`avail_${availKey}_banner`, lang))}</strong>
         ${cert.availability_note ? `<span class="muted"> ${escapeHtml(cert.availability_note)}</span>` : ""}
       </div>`;

  panel.innerHTML = `
    <div class="detail-head">
      <div class="detail-title">
        <span class="detail-abbr">${escapeHtml(cert.abbr)}</span>
        ${cert.japan_only ? `<span class="jp-badge">JP</span>` : ""}
        ${availBadge}
        ${tierBadge(eval_.computed_tier)}
        <span class="detail-name">${escapeHtml(name)}</span>
      </div>
      <div class="detail-actions">
        <a class="detail-link" href="${escapeHtml(cert.official?.exam_url || cert.vendor?.url || "#")}" target="_blank" rel="noopener">${t("open_official", lang)}</a>
        <button type="button" class="icon-btn" data-action="close" title="${t("hide_details_tooltip", lang)}">${t("hide_details", lang)} ✕</button>
      </div>
    </div>
    ${availBanner}
    <div class="detail-grid">
      <section>
        <h4>${t("vendor", lang)}</h4>
        <p><a href="${escapeHtml(cert.vendor?.url || "#")}" target="_blank" rel="noopener">${escapeHtml(cert.vendor?.name || "")}</a> <span class="muted">(${escapeHtml(cert.vendor?.slug || "")})</span></p>
        <h4>${t("domain", lang)}</h4>
        <p>${escapeHtml(cert.domain)}${
          (cert.secondary_domains || []).length
            ? ` <span class="muted">+ ${(cert.secondary_domains || []).map(escapeHtml).join(", ")}</span>` : ""
        }</p>
        <h4>${t("logistics", lang)}</h4>
        <ul class="kv">
          <li><span>${t("cost_usd", lang)}</span><span>${log.cost_usd != null ? log.cost_usd + t("unit_usd", lang) : "—"}</span></li>
          <li><span>${t("cost_local", lang)}</span><span>${escapeHtml(log.cost_local || "—")}</span></li>
          <li><span>${t("format", lang)}</span><span>${escapeHtml(log.format || "—")}</span></li>
          <li><span>${t("duration", lang)}</span><span>${log.duration_min != null ? log.duration_min + t("unit_minutes", lang) : "—"}</span></li>
          <li><span>${t("questions", lang)}</span><span>${fmtNum(log.questions)}</span></li>
          <li><span>${t("languages", lang)}</span><span>${escapeHtml((log.languages || []).join(", ") || "—")}</span></li>
          <li><span>${t("renewal", lang)}</span><span>${log.renewal_years != null ? log.renewal_years + t("unit_yrs", lang) : "—"}</span></li>
        </ul>
        <h4>${t("prerequisites", lang)}</h4>
        <p>${expYrs ? `${expYrs}${t("unit_yrs", lang).trim()} ${t("experience_yrs", lang)}` : "—"}</p>
      </section>
      <section>
        <h4>${t("plus_factors", lang)}</h4>
        <ul class="factors">${factorPlus || "<li class='muted'>—</li>"}</ul>
        <h4>${t("minus_factors", lang)}</h4>
        <ul class="factors">${factorMinus || "<li class='muted'>—</li>"}</ul>
      </section>
      <section>
        <h4>${t("third_party_evals", lang)}</h4>
        <ul class="sources">${thirdParty || "<li class='muted'>—</li>"}</ul>
        <h4>${t("sources", lang)}</h4>
        <ul class="sources">${sources || "<li class='muted'>—</li>"}</ul>
      </section>
      <section>
        <h4>${t("persona_eval", lang)}</h4>
        <p class="muted">${escapeHtml(eval_.rationale || "")}</p>
        <ul class="personas">${personasHtml || "<li class='muted'>—</li>"}</ul>
        <p class="muted small">${t("computed_at", lang)}: ${escapeHtml(eval_.computed_at || "—")} (${escapeHtml(eval_.computed_by_skill || "—")})</p>
      </section>
      <section class="rel">
        ${relatedCertList(t("required_prereqs", lang), requiredEntries, byId, ui, "required")}
        ${relatedCertList(t("recommended_prereqs", lang), recommendedEntries, byId, ui, "recommended")}
        ${relatedCertList(t("commonly_followed_by", lang), successorEntries, byId, ui)}
      </section>
    </div>
  `;

  // IMPORTANT: panel-internal handlers MUST stopPropagation on the click.
  // The dismiss / cert-link handlers trigger a re-render which replaces
  // panel.innerHTML, detaching the clicked button from the DOM. If the
  // click then keeps bubbling to the document-level "click outside chrome"
  // handler, e.target.closest("#detail-panel") returns null on the detached
  // element, so the empty-area-clear path fires by mistake and wipes the
  // selection. Stopping the bubble at the source avoids that.

  const close = panel.querySelector('[data-action="close"]');
  if (close) close.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.dispatchEvent(new CustomEvent("dismiss-panel", { bubbles: true }));
  });

  panel.addEventListener("click", e => {
    const a = e.target.closest("a[data-cert-link]");
    if (a) {
      e.preventDefault();
      e.stopPropagation();
      setState({ cert: a.dataset.certLink });
    }
  });
}
