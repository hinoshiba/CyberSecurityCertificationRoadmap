/** Certification details. Rendering owns markup only; app.js owns interaction. */
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function certUrl(id) {
  const params = new URLSearchParams(window.location.search);
  params.set("cert", id);
  return `?${params.toString()}`;
}

const COPY = {
  en: {
    close: "Close details",
    unknown: "Not recorded",
    japan: "Japan credential",
    aiTier: "AI-assessed level",
    overview: "Exam at a glance",
    official: "Visit official certification page",
    blueprint: "Exam blueprint",
    cost: "Exam cost",
    duration: "Duration",
    questions: "Questions",
    format: "Assessment format",
    languages: "Exam languages",
    renewal: "Renewal",
    ce: "Continuing education",
    experience: "Experience listed",
    minutes: "min",
    years: "years",
    zeroExperience: "0 years",
    noRenewal: "No renewal (0 years)",
    yes: "Required",
    no: "Not required",
    primaryDomain: "Primary domain",
    secondaryDomains: "Also covers",
    checked: "Official information checked",
    pricingNote:
      "Recorded fees may exclude training, taxes, or renewal. Confirm current terms with the issuer.",
    requirements: "Eligibility & requirements",
    noRequirements:
      "No formal requirements recorded. Check the issuer’s eligibility criteria.",
    path: "Your next steps",
    pathNote:
      "Required credentials are distinguished from suggested learning routes. A suggested route is not an admission requirement.",
    before: "Explore before this",
    required: "Required credentials",
    next: "Explore after this",
    noPath: "No connected credentials recorded yet.",
    sourceRequired: "Official requirement",
    sourceRecommended: "Official recommendation",
    sourceLadder: "AI-inferred vendor progression",
    sourceCommunity: "Community suggestion",
    sourceUnknown: "Suggested route",
    relationEvidence: "Relationship source",
    missingCert: "Not yet in this catalog",
    available: "Available",
    paused: "Paused",
    retired: "Retired",
    "coming-soon": "Coming soon",
    availabilityNote: "Availability note",
    evaluation: "Why this level?",
    aiNote:
      "This placement is an independent AI assessment of the recorded facts. It is not an issuer ranking or a guarantee of career outcomes.",
    noEvaluation: "An evaluation rationale has not been recorded.",
    personas: "Reviewer perspectives",
    evaluated: "Evaluated",
    skill: "Evaluation skill",
    evidence: "Sources & evaluation evidence",
    positive: "Supporting factors",
    negative: "Limiting factors",
    thirdParty: "Third-party assessments",
    sources: "Reference sources",
    weight: "Weight hint",
    evidenceLink: "Evidence",
    sourceLink: "Source",
    sourceType: "Source type",
    sourceUse: "Use",
    officialType: "Official issuer",
    regulator: "Regulator",
    third_party: "Third party",
    community: "Community",
    data: "Certification facts",
    inspiration_only: "Inspiration only",
    high: "High",
    medium: "Medium",
    low: "Low",
    noEvidence: "No entries recorded.",
    rawCode: "Factor code",
    unknownTier: "Level not evaluated",
  },
  ja: {
    close: "詳細を閉じる",
    unknown: "記載なし",
    japan: "日本の資格",
    aiTier: "AIによる評価レベル",
    overview: "試験の基本情報",
    official: "資格の公式サイトを見る",
    blueprint: "試験範囲・シラバス",
    cost: "受験費用",
    duration: "試験時間",
    questions: "問題数",
    format: "試験・審査形式",
    languages: "受験言語",
    renewal: "更新",
    ce: "継続教育",
    experience: "記録されている実務経験",
    minutes: "分",
    years: "年",
    zeroExperience: "0年",
    noRenewal: "更新なし（0年）",
    yes: "必要",
    no: "不要",
    primaryDomain: "主な分野",
    secondaryDomains: "関連する分野",
    checked: "公式情報の確認日",
    pricingNote:
      "記録された費用には、研修・税金・更新費用が含まれない場合があります。最新の条件は公式サイトで確認してください。",
    requirements: "受験資格・前提条件",
    noRequirements:
      "正式な条件の記録はありません。受験資格は公式サイトで確認してください。",
    path: "学習ルートを探す",
    pathNote:
      "必須資格と推奨する学習ルートを区別しています。推奨ルートは受験条件ではありません。",
    before: "この資格の前に学ぶ",
    required: "必須の資格",
    next: "この資格の次に学ぶ",
    noPath: "関連する資格はまだ記録されていません。",
    sourceRequired: "公式の必須条件",
    sourceRecommended: "公式の推奨",
    sourceLadder: "AI推定のベンダ内ルート",
    sourceCommunity: "コミュニティの推奨",
    sourceUnknown: "推奨ルート",
    relationEvidence: "関係の出典",
    missingCert: "一覧への追加前の資格",
    available: "受験可能",
    paused: "一時停止",
    retired: "終了",
    "coming-soon": "開始予定",
    availabilityNote: "提供状況の補足",
    evaluation: "このレベルの理由",
    aiNote:
      "記録された情報に基づく、独立したAIの評価です。提供元による順位付けや、キャリア成果の保証ではありません。",
    noEvaluation: "評価の理由はまだ記録されていません。",
    personas: "レビュワーごとの見解",
    evaluated: "評価日時",
    skill: "評価スキル",
    evidence: "出典・評価の根拠",
    positive: "加点の根拠",
    negative: "減点の根拠",
    thirdParty: "第三者機関の評価",
    sources: "参照した資料",
    weight: "重要度の目安",
    evidenceLink: "根拠を見る",
    sourceLink: "出典を見る",
    sourceType: "出典の種類",
    sourceUse: "参照用途",
    officialType: "公式の提供元",
    regulator: "公的機関",
    third_party: "第三者機関",
    community: "コミュニティ",
    data: "資格情報",
    inspiration_only: "着想のみ",
    high: "高",
    medium: "中",
    low: "低",
    noEvidence: "記録はありません。",
    rawCode: "評価要素のコード",
    unknownTier: "レベル未評価",
  },
};

function externalLink(url, label, className = "secondary-link") {
  const safe = safeUrl(url);
  if (!safe) return `<span class="muted">${escapeHtml(label)}</span>`;
  return `<a class="${className}" href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`;
}

function sourceName(url) {
  const safe = safeUrl(url);
  return safe
    ? new URL(safe).hostname.replace(/^www\./, "")
    : String(url || "");
}

function readableCode(code) {
  return String(code || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

export function renderDetailPanel(panel, cert, byId, ui = {}) {
  if (!cert) {
    panel.innerHTML = "";
    return;
  }
  const lang = ui.labelLang === "ja" ? "ja" : "en";
  const copy = COPY[lang];
  const locale = lang === "ja" ? "ja-JP" : "en-US";
  const translate = (key) => copy[key] || key;
  const e = escapeHtml;
  const name = lang === "ja" ? cert.name_ja || cert.name : cert.name;
  const logistics = cert.logistics || {};
  const prerequisites = cert.prerequisites || {};
  const evaluation = cert.evaluation || {};
  const domains = ui.domains || [];
  const tiers = ui.tiers || [];
  const localizedLabel = (collection, id) => {
    const item = collection.find((entry) => entry.id === id);
    return item
      ? lang === "ja"
        ? item.label_ja || item.label_en
        : item.label_en
      : id;
  };
  const tierLabel = (id) => (id ? localizedLabel(tiers, id) : copy.unknownTier);
  const badge = (id) =>
    `<span class="badge tier-badge" data-tier="${e(id || "unknown")}">${e(tierLabel(id))}</span>`;
  const formatDate = (value, withTime = false) => {
    if (!value) return copy.unknown;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return (
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        ...(withTime ? { timeStyle: "short" } : {}),
        timeZone: "UTC",
      }).format(date) + (withTime ? " UTC" : "")
    );
  };
  const numeric = (value, suffix = "") =>
    value == null
      ? copy.unknown
      : `${new Intl.NumberFormat(locale).format(value)}${suffix ? ` ${suffix}` : ""}`;
  const fact = (label, value) =>
    `<div><dt class="fact-label">${e(label)}</dt><dd class="fact-value">${e(value || copy.unknown)}</dd></div>`;
  const displayLanguages = (values) => {
    if (!values?.length) return copy.unknown;
    let display;
    try {
      display = new Intl.DisplayNames([lang], { type: "language" });
    } catch {
      /* Native language names are an enhancement. */
    }
    return values
      .map((value) => {
        try {
          return display?.of(value) || value;
        } catch {
          return value;
        }
      })
      .join(lang === "ja" ? "、" : ", ");
  };
  const cost =
    [
      logistics.cost_usd == null
        ? ""
        : new Intl.NumberFormat(locale, {
            style: "currency",
            currency: "USD",
            currencyDisplay: "code",
            maximumFractionDigits: 2,
          }).format(logistics.cost_usd),
      logistics.cost_local || "",
    ]
      .filter(Boolean)
      .join(" / ") || copy.unknown;
  const experience =
    prerequisites.experience_years === 0
      ? copy.zeroExperience
      : numeric(prerequisites.experience_years, copy.years);
  const renewal =
    logistics.renewal_years === 0
      ? copy.noRenewal
      : numeric(logistics.renewal_years, copy.years);
  const availability = cert.availability || "available";

  const relationLabel = (entry) =>
    entry.required
      ? copy.sourceRequired
      : {
          "official-recommended": copy.sourceRecommended,
          "vendor-ladder": copy.sourceLadder,
          community: copy.sourceCommunity,
        }[entry.source] || copy.sourceUnknown;
  const relationList = (title, entries) => {
    if (!entries.length) return "";
    const items = entries
      .map((entry) => {
        const related = byId.get(entry.id);
        const relatedName = related
          ? lang === "ja"
            ? related.name_ja || related.name
            : related.name
          : copy.missingCert;
        const titleHtml = related
          ? `<a href="${e(certUrl(entry.id))}" data-cert-link="${e(entry.id)}"><strong>${e(related.abbr)}</strong><span>${e(relatedName)}</span><span class="muted">${e(related.vendor?.name || "")}</span><span aria-hidden="true">→</span></a>`
          : `<strong>${e(entry.id)}</strong><span class="muted">${e(relatedName)}</span>`;
        return `<li class="relation-item">${titleHtml}<span class="relation-source">${e(relationLabel(entry))}</span>${entry.rationale || entry.note ? `<p class="muted">${e(entry.rationale || entry.note)}</p>` : ""}${entry.url ? externalLink(entry.url, copy.relationEvidence) : ""}</li>`;
      })
      .join("");
    return `<h4 class="section-heading">${e(title)}</h4><ul class="relation-list">${items}</ul>`;
  };
  const normalizeEntry = (entry, required = false) =>
    typeof entry === "string"
      ? { id: entry, required }
      : { ...entry, required };
  const required = (prerequisites.required_certs || []).map((entry) =>
    normalizeEntry(entry, true),
  );
  const recommended = (prerequisites.recommended_certs || []).map((entry) =>
    normalizeEntry(entry),
  );
  const next = [];
  for (const related of byId.values()) {
    for (const [key, requiredRelation] of [
      ["required_certs", true],
      ["recommended_certs", false],
    ]) {
      for (const raw of related.prerequisites?.[key] || []) {
        const entry = normalizeEntry(raw, requiredRelation);
        if (entry.id === cert.id) next.push({ ...entry, id: related.id });
      }
    }
  }
  next.sort(
    (a, b) =>
      Number(b.required) - Number(a.required) ||
      (byId.get(a.id)?.abbr || a.id).localeCompare(
        byId.get(b.id)?.abbr || b.id,
      ),
  );

  const factors = (entries) =>
    entries?.length
      ? `<ul class="evidence-list">${entries.map((item) => `<li><strong>${e(readableCode(item.code))}</strong><p class="muted">${e(copy.weight)}: ${e(translate(item.weight_hint))}</p>${item.note ? `<p>${e(item.note)}</p>` : ""}<p class="muted"><span>${e(copy.rawCode)}:</span> <code>${e(item.code)}</code></p>${item.evidence ? externalLink(item.evidence, copy.evidenceLink) : ""}</li>`).join("")}</ul>`
      : `<p class="muted">${e(copy.noEvidence)}</p>`;
  const sources = cert.sources || [];
  const sourceType = (type) =>
    type === "official" ? copy.officialType : translate(type);
  const sourceList = sources.length
    ? `<ul class="evidence-list">${sources.map((source) => `<li>${externalLink(source.url, source.name || sourceName(source.url) || copy.sourceLink)}<p class="muted">${e(sourceType(source.type))}${source.use ? ` · ${e(translate(source.use))}` : ""}</p></li>`).join("")}</ul>`
    : `<p class="muted">${e(copy.noEvidence)}</p>`;
  const thirdParty = cert.third_party_evaluations || [];
  const thirdPartyList = thirdParty.length
    ? `<ul class="evidence-list">${thirdParty.map((entry) => `<li><strong>${e(entry.source_id)}</strong>${entry.level_hint ? ` ${badge(entry.level_hint)}` : ""}${entry.summary ? `<p>${e(entry.summary)}</p>` : ""}<p class="muted">${e(copy.checked)}: ${e(formatDate(entry.fetched_at))}</p>${externalLink(entry.url, sourceName(entry.url) || copy.sourceLink)}</li>`).join("")}</ul>`
    : `<p class="muted">${e(copy.noEvidence)}</p>`;
  const personas = Object.entries(evaluation.persona_scores || {});
  const personaList = personas.length
    ? `<ul class="evidence-list">${personas
        .map(
          ([who, score]) =>
            `<li><strong>${e(
              who
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" "),
            )}</strong> ${badge(score.tier)}<p>${e(score.rationale)}</p></li>`,
        )
        .join("")}</ul>`
    : `<p class="muted">${e(copy.noEvidence)}</p>`;
  const formal = prerequisites.formal || [];
  const officialUrl =
    safeUrl(cert.official?.exam_url) || safeUrl(cert.vendor?.url);
  const secondaryDomains = [...new Set(cert.secondary_domains || [])].filter(
    (id) => id !== cert.domain,
  );

  panel.innerHTML = `
    <div class="detail-topline"><span class="detail-vendor">${externalLink(cert.vendor?.url, cert.vendor?.name || copy.unknown)}</span><button type="button" class="icon-btn" data-action="close" aria-label="${e(copy.close)}" title="${e(copy.close)}"><span aria-hidden="true">×</span></button></div>
    <h2 id="detail-title" class="detail-title">${e(cert.abbr)}</h2>
    <p class="detail-name">${e(name)}</p>
    <div class="detail-badges"><span title="${e(copy.aiTier)}">${badge(evaluation.computed_tier)}</span>${cert.japan_only ? `<span class="badge">${e(copy.japan)}</span>` : ""}<span class="badge availability-badge" data-availability="${e(availability)}">${e(translate(availability))}</span></div>
    ${cert.availability_note ? `<p class="availability-note"><strong>${e(copy.availabilityNote)}:</strong> ${e(cert.availability_note)}</p>` : ""}
    <div class="detail-section detail-official">${externalLink(officialUrl, copy.official, "official-link")}${cert.official?.blueprint_url ? externalLink(cert.official.blueprint_url, copy.blueprint) : ""}</div>
    <section class="detail-section" aria-labelledby="detail-overview"><h3 id="detail-overview" class="section-heading">${e(copy.overview)}</h3>
      <dl class="facts-grid">${fact(copy.cost, cost)}${fact(copy.duration, numeric(logistics.duration_min, copy.minutes))}${fact(copy.experience, experience)}${fact(copy.renewal, renewal)}${fact(copy.questions, numeric(logistics.questions))}${fact(copy.ce, logistics.ce_required == null ? copy.unknown : logistics.ce_required ? copy.yes : copy.no)}${fact(copy.languages, displayLanguages(logistics.languages))}${fact(copy.format, logistics.format)}${fact(copy.primaryDomain, localizedLabel(domains, cert.domain))}${secondaryDomains.length ? fact(copy.secondaryDomains, secondaryDomains.map((id) => localizedLabel(domains, id)).join(lang === "ja" ? "、" : ", ")) : ""}</dl>
      <p class="muted detail-freshness">${e(copy.checked)}: ${e(formatDate(cert.official?.fetched_at))}</p><p class="muted detail-note">${e(copy.pricingNote)}</p>
    </section>
    <section class="detail-section" aria-labelledby="detail-requirements"><h3 id="detail-requirements" class="section-heading">${e(copy.requirements)}</h3>${formal.length ? `<ul class="evidence-list">${formal.map((item) => `<li>${e(item)}</li>`).join("")}</ul>` : required.length ? "" : `<p class="muted">${e(copy.noRequirements)}</p>`}${relationList(copy.required, required)}</section>
    <section class="detail-section" aria-labelledby="detail-path"><h3 id="detail-path" class="section-heading">${e(copy.path)}</h3><p class="muted">${e(copy.pathNote)}</p>${relationList(copy.before, recommended)}${relationList(copy.next, next)}${!recommended.length && !next.length ? `<p class="muted">${e(copy.noPath)}</p>` : ""}</section>
    <details class="detail-section detail-disclosure"><summary class="section-heading">${e(copy.evaluation)}</summary><p class="muted">${e(copy.aiNote)}</p><p>${e(evaluation.rationale || copy.noEvaluation)}</p><h4 class="section-heading">${e(copy.personas)}</h4>${personaList}<p class="muted">${e(copy.evaluated)}: ${e(formatDate(evaluation.computed_at, true))}</p><p class="muted">${e(copy.skill)}: ${e(evaluation.computed_by_skill || copy.unknown)}</p></details>
    <details class="detail-section detail-disclosure"><summary class="section-heading">${e(copy.evidence)}</summary><h4 class="section-heading">${e(copy.sources)}</h4>${sourceList}<h4 class="section-heading">${e(copy.thirdParty)}</h4>${thirdPartyList}<h4 class="section-heading">${e(copy.positive)}</h4>${factors(cert.scoring_factors?.plus)}<h4 class="section-heading">${e(copy.negative)}</h4>${factors(cert.scoring_factors?.minus)}</details>
  `;
}
