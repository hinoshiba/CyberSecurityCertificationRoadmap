/**
 * Tiny key→{en,ja} table for UI labels that aren't already in the cert data.
 * Cert names / domain names / tier names come from the JSON itself; this
 * covers the chrome around them.
 */
const STRINGS = {
  filter_options: {en:"Filter by domain, level, or language",ja:"主分野・レベル・言語で絞り込む"},
  vendor_counts_note: {en: "Counts show each vendor’s full catalog on this roadmap.", ja: "件数は各ベンダの全収録資格数です。"},
  skip_results: {"en": "Skip to results", "ja": "検索結果へ移動"},
  explorer_kicker: {"en": "EXPLORE YOUR NEXT STEP", "ja": "次の一歩を見つける"},
  explorer_title: {"en": "Find your next certification", "ja": "自分に合う資格を探す"},
  explorer_intro: {"en": "Explore the landscape, narrow your options, then check the evidence.", "ja": "全体像をつかみ、条件で絞り、資格の内容と取得経路を確認しましょう。"},
  search_label: {"en": "Search certifications", "ja": "資格を検索"},
  search_help: {"en": "Abbreviation, full name, or vendor. Combine words to narrow results.", "ja": "略称・正式名称・ベンダ名で検索。スペースで複数の語を組み合わせられます。"},
  search_placeholder: {"en": "Try CISSP, Security+, or Microsoft", "ja": "例: CISSP、情報処理安全確保支援士、Microsoft"},
  clear_search: {"en": "Clear search", "ja": "検索をクリア"},
  primary_domain: {"en": "Primary domain", "ja": "主分野"},
  tier_filter: {"en": "Level (AI guide)", "ja": "レベル（AI評価の目安）"},
  exam_language: {"en": "Recorded exam language", "ja": "試験言語（記録あり）"},
  filter_vendor: {"en": "Vendors", "ja": "ベンダ"},
  all_vendors: {"en": "All", "ja": "すべて"},
  no_vendors: {"en": "None", "ja": "選択解除"},
  include_jp: {"en": "Include Japan-only certifications", "ja": "日本限定の資格も含める"},
  scope_note: {"en": "Levels are AI-evaluated guides, not an official difficulty ranking. Specialty is a separate category. Exam languages reflect recorded data.", "ja": "レベルはAI評価による目安です。公式の難易度順位ではなく、スペシャリティは独立した専門区分です。試験言語は記録済み情報で絞り込みます。"},
  browse_domains: {"en": "Explore all 12 domains", "ja": "12の分野から全体像をつかむ"},
  list_view: {"en": "Results", "ja": "資格一覧"},
  map_view: {"en": "Roadmap", "ja": "ロードマップ"},
  all_domains: {"en": "All domains", "ja": "すべての分野"},
  all_tiers: {"en": "All levels", "ja": "すべてのレベル"},
  all_languages: {"en": "All exam languages", "ja": "すべての試験言語"},
  reset_filters: {"en": "Reset search & filters", "ja": "検索・条件をリセット"},
  no_filters: {"en": "All certifications in the selected scope", "ja": "指定した範囲のすべての資格"},
  active_filters: {"en": "Active filters", "ja": "適用中の条件"},
  hidden_selection: {"en": "The selected certification is outside your current filters.", "ja": "選択中の資格は現在の検索・条件の対象外です。"},
  show_selected: {"en": "Show selected certification", "ja": "選択資格を表示"},
  view_label: {"en": "View", "ja": "表示方法"},
  label_language: {"en": "日本語 / English", "ja": "日本語 / English"},
  map_hint: {"en": "Filtered roadmap. Select a certification to see related paths. Related certifications outside these filters remain available in Details.", "ja": "絞り込み後のロードマップです。資格を選ぶと関連経路を表示します。条件外の関連資格は詳細で確認できます。"},
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
  tools:                { en: "Tools",                                 ja: "ツール" },
  tools_tooltip:        { en: "Open tools",                            ja: "ツールを開く" },
  show_overview:        { en: "Overview",                              ja: "俯瞰図" },
  show_overview_tooltip:{ en: "Jump back to the roadmap overview.",     ja: "ロードマップ俯瞰図へ戻ります。" },
  overview_aria:        { en: "Roadmap overview",                      ja: "ロードマップ俯瞰図" },
  overview_title:       { en: "Overview",                              ja: "俯瞰図" },
  overview_note:        { en: "Tap a cell to jump",                    ja: "セルをタップして移動" },
  overview_tier_axis:   { en: "Tier",                                  ja: "段階" },
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

  // vendor-highlight threshold
  vt_label:   { en: "Vendor highlight ≥",                                              ja: "ベンダ強調: 資格数" },
  vt_suffix:  { en: "certs",                                                           ja: "件以上" },
  vt_tooltip: { en: "Tint cards whose vendor publishes at least this many certs (blank / 0 disables).", ja: "この件数以上の資格を提供しているベンダの背景を強調表示します (空欄または 0 で無効)。" },

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
