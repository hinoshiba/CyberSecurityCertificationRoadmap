/**
 * Draw the filtered roadmap directly into a PNG. Export geometry is independent
 * of the viewport, scroll position and DOM: every supplied certification appears
 * once in its primary domain, with text wrapped instead of shrunk or truncated.
 */
import { loadVersion, versionLabel } from "./version.js";

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif';
const COLORS = {
  ink: "#172c2b",
  muted: "#526762",
  line: "#dce5e0",
  green: "#176b50",
  greenLight: "#f0f7f2",
  purple: "#79549c",
  purpleLight: "#f6f0fb",
  white: "#ffffff",
};
const LABEL_SIZE = 14;
const LINE_HEIGHT = 20;
const CARD_PAD = 12;
const CARD_GAP = 8;
const CELL_PAD = 10;
const MARGIN = 36;
const AXIS_WIDTH = 172;
const COLUMN_MIN = 180;

function label(item, lang) {
  return (lang === "ja" && item.label_ja) || item.label_en || item.id;
}

function setFont(ctx, size = LABEL_SIZE, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/** Keep all characters, including long identifiers and Japanese text. */
function wrapText(ctx, value, width) {
  const lines = [];
  for (const paragraph of String(value ?? "").split(/\r?\n/)) {
    let line = "";
    for (const token of paragraph.match(/\S+\s*|\s+/gu) || [""]) {
      if (line && ctx.measureText(line + token).width > width) {
        lines.push(line.trimEnd());
        line = "";
      }
      for (const char of token) {
        if (line && ctx.measureText(line + char).width > width) {
          lines.push(line.trimEnd());
          line = "";
        }
        if (line || char.trim()) line += char;
      }
    }
    if (line || !paragraph) lines.push(line.trimEnd());
  }
  return lines.length ? lines : [""];
}

function drawLines(ctx, lines, x, y, height = LINE_HEIGHT) {
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += height;
  }
  return y;
}

function rectangle(ctx, x, y, width, height, fill, border = null) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }
}

function cardLayout(ctx, cert, width, lang) {
  const abbr = String(cert.abbr || cert.name || cert.id);
  const fullName = String(
    (lang === "ja" ? cert.name_ja || cert.name : cert.name) || "",
  );
  const vendor = String(cert.vendor?.name || "");
  setFont(ctx, LABEL_SIZE, 700);
  const title = wrapText(ctx, abbr, width - 2 * CARD_PAD);
  setFont(ctx);
  const name =
    fullName && fullName !== abbr
      ? wrapText(ctx, fullName, width - 2 * CARD_PAD)
      : [];
  setFont(ctx, 12);
  const publisher = vendor ? wrapText(ctx, vendor, width - 2 * CARD_PAD) : [];
  return {
    title,
    name,
    publisher,
    height:
      CARD_PAD * 2 +
      (title.length + name.length) * LINE_HEIGHT +
      (name.length ? 4 : 0) +
      (publisher.length ? 6 + publisher.length * 17 : 0),
  };
}

function drawCard(ctx, card, x, y, width, specialty) {
  rectangle(ctx, x, y, width, card.height, COLORS.white, COLORS.line);
  rectangle(
    ctx,
    x,
    y,
    3,
    card.height,
    specialty ? COLORS.purple : COLORS.green,
  );
  setFont(ctx, LABEL_SIZE, 700);
  ctx.fillStyle = COLORS.ink;
  let textY = drawLines(ctx, card.title, x + CARD_PAD, y + CARD_PAD);
  if (card.name.length) {
    setFont(ctx);
    textY = drawLines(ctx, card.name, x + CARD_PAD, textY + 4);
  }
  if (card.publisher.length) {
    setFont(ctx, 12);
    ctx.fillStyle = COLORS.muted;
    drawLines(ctx, card.publisher, x + CARD_PAD, textY + 6, 17);
  }
}

function asBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob?.size) resolve(blob);
        else
          reject(
            new Error(
              "The browser could not create the PNG. Try exporting fewer certifications.",
            ),
          );
      }, "image/png");
    } catch (error) {
      reject(
        new Error("The browser could not encode the PNG.", { cause: error }),
      );
    }
  });
}

function download(blob, date) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = `security-certification-roadmap-${date.toISOString().replace(/[:.]/g, "-")}.png`;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Give the download time to consume the blob, including on mobile Safari.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** certs is the already-filtered set; no user filters are reinterpreted here. */
export async function exportRoadmapPNG({
  certs,
  domains,
  tiers,
  lang = "en",
  queryLabel = "",
}) {
  if (
    !Array.isArray(certs) ||
    !Array.isArray(domains) ||
    !domains.length ||
    !Array.isArray(tiers) ||
    !tiers.length
  ) {
    throw new Error("The roadmap data is not available for export.");
  }
  if (!certs.length)
    throw new Error(
      lang === "ja"
        ? "書き出す資格がありません。絞り込みを変更してください。"
        : "No certifications to export. Change the filters and try again.",
    );

  const version = await loadVersion();
  if (document.fonts?.ready) await document.fonts.ready;
  const date = new Date();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser does not support PNG export.");

  const width = Math.max(
    2400,
    MARGIN * 2 + AXIS_WIDTH + domains.length * COLUMN_MIN,
  );
  const columnWidth = (width - MARGIN * 2 - AXIS_WIDTH) / domains.length;
  const cardWidth = columnWidth - 2 * CELL_PAD;
  const displayOrder = [
    "expert",
    "professional",
    "associate",
    "foundational",
    "introductory",
    "specialty",
  ];
  const orderedTiers = [...tiers].sort(
    (a, b) => displayOrder.indexOf(a.id) - displayOrder.indexOf(b.id),
  );
  const buckets = new Map(
    orderedTiers.flatMap((tier) =>
      domains.map((domain) => [`${tier.id}|${domain.id}`, []]),
    ),
  );
  for (const cert of certs) {
    const tier = cert.evaluation?.computed_tier || "specialty";
    const bucket = buckets.get(`${tier}|${cert.domain}`);
    // Never silently leave a supplied certification out of the exported map.
    if (!bucket)
      throw new Error(
        `Cannot place certification ${cert.id}: unknown domain or tier.`,
      );
    bucket.push(cert);
  }

  const rows = orderedTiers.map((tier) => {
    const columns = domains.map((domain) =>
      buckets
        .get(`${tier.id}|${domain.id}`)
        .sort((a, b) =>
          String(a.abbr || a.name || a.id).localeCompare(
            String(b.abbr || b.name || b.id),
            lang,
          ),
        )
        .map((cert) => cardLayout(ctx, cert, cardWidth, lang)),
    );
    return {
      tier,
      columns,
      height: Math.max(
        110,
        ...columns.map(
          (cards) =>
            2 * CELL_PAD +
            cards.reduce(
              (sum, card) => sum + card.height + CARD_GAP,
              -CARD_GAP,
            ),
        ),
      ),
    };
  });

  setFont(ctx, 16);
  const filterLines = wrapText(
    ctx,
    queryLabel || (lang === "ja" ? "すべての資格" : "All certifications"),
    width - 2 * MARGIN,
  );
  const introHeight = 142 + filterLines.length * 23;
  setFont(ctx, 15, 700);
  const domainLabels = domains.map((domain) =>
    wrapText(ctx, label(domain, lang), columnWidth - 22),
  );
  const headerHeight = Math.max(
    100,
    ...domainLabels.map((lines) => 28 + lines.length * LINE_HEIGHT),
  );
  const url = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
  setFont(ctx, 14);
  const footerLines = [
    lang === "ja"
      ? "スペシャリティは専門領域であり、エキスパートの上位ではありません。"
      : "Specialty is a focused track, not a level above Expert.",
    "CC BY-SA 4.0 · Inspired by Paul Jerimy and CyberDudeKZ · Independently curated certification data",
    `${versionLabel(version)} · ${lang === "ja" ? "生成日時" : "Generated"} ${date.toISOString().replace("T", " ").slice(0, 19)} UTC`,
    url,
  ].flatMap((line) => wrapText(ctx, line, width - 2 * MARGIN));
  const footerHeight = 52 + footerLines.length * 22;
  const tableHeight =
    headerHeight + rows.reduce((sum, row) => sum + row.height, 0);
  const height = Math.ceil(introHeight + tableHeight + footerHeight + MARGIN);
  // Fail with a useful message instead of returning a blank, oversized canvas.
  if (width > 32767 || height > 32767 || width * height > 64_000_000) {
    throw new Error(
      lang === "ja"
        ? "画像が大きすぎます。絞り込んで再度書き出してください。"
        : "The image is too large. Narrow the filters and export again.",
    );
  }
  canvas.width = width;
  canvas.height = height;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  rectangle(ctx, 0, 0, width, height, COLORS.white);
  rectangle(ctx, MARGIN, 30, 48, 5, COLORS.green);
  rectangle(ctx, MARGIN + 54, 30, 24, 5, COLORS.purple);
  setFont(ctx, 36, 700);
  ctx.fillStyle = COLORS.ink;
  ctx.fillText("Security Certification Roadmap", MARGIN, 50);
  setFont(ctx, 16);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(
    `by hinoshiba · ${certs.length} ${lang === "ja" ? "資格" : "certifications"} · ${domains.length} ${lang === "ja" ? "分野" : "domains"}`,
    MARGIN,
    100,
  );
  ctx.fillStyle = COLORS.green;
  drawLines(ctx, filterLines, MARGIN, 132, 23);

  const tableX = MARGIN;
  let rowY = introHeight;
  rectangle(
    ctx,
    tableX,
    rowY,
    AXIS_WIDTH,
    headerHeight,
    COLORS.greenLight,
    COLORS.line,
  );
  setFont(ctx, 14, 700);
  ctx.fillStyle = COLORS.ink;
  drawLines(
    ctx,
    lang === "ja" ? ["レベル ↓", "分野 →"] : ["Level ↓", "Domain →"],
    tableX + 14,
    rowY + 20,
    25,
  );
  domains.forEach((domain, index) => {
    const x = tableX + AXIS_WIDTH + index * columnWidth;
    rectangle(
      ctx,
      x,
      rowY,
      columnWidth,
      headerHeight,
      COLORS.greenLight,
      COLORS.line,
    );
    rectangle(
      ctx,
      x + 1,
      rowY + 1,
      columnWidth - 2,
      4,
      domain.color || COLORS.green,
    );
    setFont(ctx, 15, 700);
    ctx.fillStyle = COLORS.ink;
    drawLines(ctx, domainLabels[index], x + 11, rowY + 19);
  });
  rowY += headerHeight;

  for (const row of rows) {
    const specialty = row.tier.id === "specialty";
    const tint = specialty ? COLORS.purpleLight : COLORS.greenLight;
    rectangle(ctx, tableX, rowY, AXIS_WIDTH, row.height, tint, COLORS.line);
    setFont(ctx, 16, 700);
    ctx.fillStyle = specialty ? COLORS.purple : COLORS.green;
    drawLines(
      ctx,
      wrapText(ctx, label(row.tier, lang), AXIS_WIDTH - 28),
      tableX + 14,
      rowY + 19,
      23,
    );
    row.columns.forEach((cards, index) => {
      const x = tableX + AXIS_WIDTH + index * columnWidth;
      rectangle(ctx, x, rowY, columnWidth, row.height, tint, COLORS.line);
      let cardY = rowY + CELL_PAD;
      for (const card of cards) {
        drawCard(ctx, card, x + CELL_PAD, cardY, cardWidth, specialty);
        cardY += card.height + CARD_GAP;
      }
      if (!cards.length) {
        setFont(ctx, 16);
        ctx.fillStyle = COLORS.muted;
        ctx.fillText("—", x + CELL_PAD + CARD_PAD, cardY + CARD_PAD);
      }
    });
    rowY += row.height;
  }

  setFont(ctx, 14);
  ctx.fillStyle = COLORS.muted;
  drawLines(ctx, footerLines, MARGIN, rowY + 26, 22);
  const blob = await asBlob(canvas);
  download(blob, date);
  // Release the bitmap after encoding; the download owns its Blob independently.
  canvas.width = canvas.height = 1;
  return { width, height, count: certs.length };
}
