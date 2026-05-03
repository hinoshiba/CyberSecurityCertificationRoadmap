/**
 * Tiny key→{en,ja} table for UI labels that aren't already in the cert data.
 * Cert names / domain names / tier names come from the JSON itself; this
 * covers the chrome around them.
 */
const STRINGS = {
  // detail panel section headings
  vendor:               { en: "Vendor",                       ja: "ベンダ" },
  domain:               { en: "Domain",                       ja: "ドメイン" },
  logistics:            { en: "Logistics",                    ja: "受験情報" },
  prerequisites:        { en: "Prerequisites",                ja: "前提" },
  plus_factors:         { en: "Plus factors",                 ja: "加点要素" },
  minus_factors:        { en: "Minus factors",                ja: "減点要素" },
  third_party_evals:    { en: "Third-party evaluations",      ja: "第三者評価" },
  sources:              { en: "Sources",                      ja: "ソース" },
  persona_eval:         { en: "3-persona evaluation",         ja: "3ペルソナ評価" },

  // zone headers (new layout)
  zone_quick:           { en: "At a glance",                  ja: "概要" },
  zone_relations:       { en: "Roadmap context",              ja: "ロードマップ上の関連資格" },
  zone_ai:              { en: "AI evaluation — why this tier?", ja: "AI による評価 — なぜこのティアか" },
  zone_evidence:        { en: "Supporting evidence (curated facts the AI used)", ja: "根拠データ (AI が参照したキュレーション情報)" },
  required_prereqs:     { en: "Required prerequisites",       ja: "必須の前提資格" },
  recommended_prereqs:  { en: "Recommended prior certs",      ja: "事前に取得することが多い資格" },
  commonly_followed_by: { en: "Commonly followed by",         ja: "次に取得されやすい資格" },

  // recommended_certs source provenance badges + tooltips
  src_official_recommended:         { en: "OFFICIAL",  ja: "公式" },
  src_official_recommended_tooltip: { en: "Vendor / authority explicitly recommends this prior cert.", ja: "ベンダ・権威機関が公式に事前取得を推奨している。" },
  src_vendor_ladder:                { en: "LADDER",    ja: "段階" },
  src_vendor_ladder_tooltip:        { en: "Implied by the same-vendor tier ladder.",                    ja: "同一ベンダのティアラダーに沿った推測。" },
  src_community:                    { en: "COMMUNITY", ja: "通説" },
  src_community_tooltip:            { en: "Community / industry-reputation pattern, not vendor-documented.", ja: "コミュニティ / 業界通説によるもの。ベンダ非公式。" },
  src_evidence:                     { en: "Evidence link", ja: "根拠リンク" },

  // logistics keys
  cost_usd:        { en: "Cost USD",       ja: "費用 (USD)" },
  cost_local:      { en: "Cost local",     ja: "費用 (現地通貨)" },
  format:          { en: "Format",         ja: "形式" },
  duration:        { en: "Duration",       ja: "所要時間" },
  questions:       { en: "Questions",      ja: "問題数" },
  languages:       { en: "Languages",      ja: "言語" },
  renewal:         { en: "Renewal",        ja: "更新" },
  experience_yrs:  { en: "yrs experience", ja: "年の実務経験" },

  // chrome
  open_official:        { en: "Open official ↗",                       ja: "公式ページを開く ↗" },
  close:                { en: "Close (ESC)",                           ja: "閉じる (ESC)" },
  hide_details:         { en: "Hide details",                          ja: "詳細を非表示" },
  hide_details_tooltip: { en: "Collapse the detail panel; arrows stay. ESC to deselect.", ja: "詳細パネルを閉じます。矢印は残ります。ESC で選択解除。" },
  show_details:         { en: "Show details",                          ja: "詳細を表示" },
  computed_at:          { en: "Computed at",                           ja: "評価日時" },
  not_in_roadmap:       { en: "(not in roadmap)",                      ja: "(未収録)" },
  none_dash:            { en: "—",                                     ja: "—" },

  // suffixes
  unit_yrs:    { en: " yrs", ja: " 年" },
  unit_minutes:{ en: " min", ja: " 分" },
  unit_usd:    { en: " USD", ja: " USD" },

  // export buttons
  export_png:        { en: "Export matrix as PNG",        ja: "ロードマップをPNGで保存" },
  png_btn_label:     { en: "📷 PNG export",               ja: "📷 PNGで保存" },
  preparing:         { en: "Preparing…",                  ja: "準備中…" },

  // context menu
  ctx_deselect:      { en: "Deselect",            ja: "選択を解除" },
  ctx_copy_abbr:     { en: "Copy abbr",           ja: "略称をコピー" },
  ctx_show_details:  { en: "Show details",        ja: "詳細を表示" },
  ctx_open_official: { en: "Open official page ↗", ja: "公式ページを開く ↗" },

  // legend
  legend_prereq: { en: "→ Prereq (▬ required ┊ ━ recommended ┄ community)",  ja: "→ 前提 (▬ 必須 ┊ ━ 推奨 ┄ 通説)" },
  legend_next:   { en: "⇢ Commonly followed by",                              ja: "⇢ 次に取得されやすい資格" },
  legend_depth:  { en: "(up to 3 hops, max 20 edges; fainter = farther)",     ja: "(最大3ホップ・最大20本、薄いほど遠い)" },
  legend_hint:   { en: "Click a cert. ESC to deselect. URL is bookmarkable.", ja: "資格をクリック。ESC で選択解除。URL はブックマーク可能。" },

  // availability
  availability:           { en: "Availability",           ja: "受験可否" },
  avail_paused_badge:     { en: "PAUSED",                 ja: "受験停止中" },
  avail_retired_badge:    { en: "RETIRED",                ja: "提供終了" },
  avail_coming_badge:     { en: "SOON",                   ja: "提供予定" },
  avail_paused_banner:    { en: "Exam delivery is currently paused.",   ja: "現在この資格は受験停止中です。" },
  avail_retired_banner:   { en: "This certification has been retired.", ja: "この資格は提供終了しています。" },
  avail_coming_banner:    { en: "Coming soon.",                          ja: "近日提供予定です。" },
};

export function t(key, lang) {
  const row = STRINGS[key];
  if (!row) return key;
  return row[lang === "ja" ? "ja" : "en"] || row.en || key;
}
