import type { CardFace } from '@team-impact/contracts';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  NAME_LINE_HEIGHT,
  backArt,
  brandPalette,
  cardColors,
  cardLayout,
  cardText,
  displayFont,
  frontArt,
  photoBleed,
  prepareCard,
  webFontFamily,
  withAlpha,
  type CardFaceArt,
  type CardPalette,
  type CardSide,
  type CardTextStyle,
  type CardTextVariant,
  type PreparedCard,
} from '@team-impact/ui-primitives/native';
import { exportCardData } from '@/components/cardExport';

/**
 * Web-only PNG export of either card face (TI-114). The same generated artwork as the card
 * primitive (`frontArt` / `backArt`), the photo and the team stripe are drawn as an SVG and
 * rasterised on a <canvas>; the text is then drawn with the canvas text API so it uses the app's
 * loaded fonts and is cut to fit. The layout mirrors the flat card face (`AthleteCardFace`), and
 * there is no tilt or shine here, so neither can end up in the image. Native apps capture the
 * flat face itself instead (`cardShare.ts`).
 *
 * Callers pass a face from `POST /cards/me/export`, which never carries contact details and only
 * exists for athletes' published cards, so a child's or teen's profile can't end up in an export.
 */

/** Values go into SVG attributes: escape them so they can only ever be data. */
const xml = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );

const W = CARD_WIDTH;
const H = CARD_HEIGHT;
const L = cardLayout;
const PHOTO_BOTTOM = L.photoInset + L.photoHeight;
const DISPLAY_FAMILY = `${displayFont.native}, ${displayFont.web}`;

const artLayers = (art: CardFaceArt) => {
  const layer = (l: (typeof art.layers)[number]) =>
    `<path d="${l.d}" fill="${l.fill ?? 'none'}"${l.stroke ? ` stroke="${l.stroke}"` : ''}${
      l.strokeWidth ? ` stroke-width="${l.strokeWidth}"` : ''
    }${l.strokeLinecap ? ` stroke-linecap="${l.strokeLinecap}"` : ''} opacity="${l.opacity}"/>`;
  const plain = art.layers
    .filter((l) => !l.clipped || !art.clip)
    .map(layer)
    .join('');
  const clipped = art.clip
    ? art.layers
        .filter((l) => l.clipped)
        .map(layer)
        .join('')
    : '';
  return `${plain}${clipped ? `<g clip-path="url(#tiArtClip)">${clipped}</g>` : ''}`;
};

/** The front photo bleeding into the card, as `PhotoBleed` draws it (mask, scrim, frame line). */
const photoSvg = (photo: string | null, palette: CardPalette) => {
  const b = photoBleed;
  const inset = L.photoInset;
  return `<defs>
<linearGradient id="tiPhotoV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="black"/><stop offset="${b.topFade}" stop-color="white"/><stop offset="${b.bottomFadeStart}" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
<linearGradient id="tiPhotoH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="black" stop-opacity="1"/><stop offset="${b.sideFade}" stop-color="black" stop-opacity="0"/><stop offset="${1 - b.sideFade}" stop-color="black" stop-opacity="0"/><stop offset="1" stop-color="black" stop-opacity="1"/></linearGradient>
<mask id="tiPhotoMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${b.height}"><rect width="${W}" height="${b.height}" fill="url(#tiPhotoV)"/><rect width="${W}" height="${b.height}" fill="url(#tiPhotoH)"/></mask>
<linearGradient id="tiPhotoFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.glow}"/><stop offset="1" stop-color="${palette.base}"/></linearGradient>
<linearGradient id="tiScrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.deep}" stop-opacity="0"/><stop offset="${(b.scrimPeak - b.scrimStart) / (1 - b.scrimStart)}" stop-color="${palette.deep}" stop-opacity="${b.scrimOpacity}"/><stop offset="1" stop-color="${palette.deep}" stop-opacity="0"/></linearGradient>
</defs>
<g mask="url(#tiPhotoMask)">${
    photo
      ? `<image href="${xml(photo)}" x="0" y="0" width="${W}" height="${b.height}" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect width="${W}" height="${b.height}" fill="url(#tiPhotoFill)"/>`
  }</g>
<rect y="${b.height * b.scrimStart}" width="${W}" height="${b.height * (1 - b.scrimStart)}" fill="url(#tiScrim)"/>
<rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${L.photoHeight}" rx="${L.photoRadius}" fill="none" stroke="${cardColors.yellow}" stroke-width="${b.frameWidth}" opacity="${b.frameOpacity}"/>`;
};

/** Everything but the text: art, photo (front) and the team stripe, clipped to the card shape. */
export const cardSvg = (
  card: PreparedCard,
  side: CardSide,
  photo: string | null,
  palette: CardPalette = brandPalette,
) => {
  const art = side === 'front' ? frontArt(card.seed, palette) : backArt(card.seed, palette);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<clipPath id="tiShape"><rect width="${W}" height="${H}" rx="${L.radius}"/></clipPath>
<linearGradient id="tiArtBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${art.gradient[0]}"/><stop offset="1" stop-color="${art.gradient[1]}"/></linearGradient>
${art.glow ? `<radialGradient id="tiArtGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${art.glow.color}" stop-opacity="${art.glow.opacity}"/><stop offset="1" stop-color="${art.glow.color}" stop-opacity="0"/></radialGradient>` : ''}
${art.clip ? `<clipPath id="tiArtClip"><path d="${art.clip}"/></clipPath>` : ''}
</defs>
<g clip-path="url(#tiShape)">
<rect width="${W}" height="${H}" fill="url(#tiArtBg)"/>
${art.glow ? `<circle cx="${art.glow.cx}" cy="${art.glow.cy}" r="${art.glow.r}" fill="url(#tiArtGlow)"/>` : ''}
${artLayers(art)}
${side === 'front' ? photoSvg(photo, palette) : ''}
<rect width="${W}" height="${L.stripe}" fill="${xml(card.teamColor)}"/>
</g>
</svg>`;
};

interface TextOptions {
  variant: CardTextVariant;
  color: string;
  /** Overrides the variant's size, e.g. the fitted name. */
  size?: number;
  maxWidth: number;
  align?: CanvasTextAlign;
  shadow?: boolean;
}

/** Draws one line, vertically centred on `y`, cut with "…" so it never overflows `maxWidth`. */
const drawText = (
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  { variant, color, size, maxWidth, align = 'left', shadow = false }: TextOptions,
) => {
  const spec: CardTextStyle = cardText[variant];
  const px = size ?? spec.fontSize;
  const family = spec.display ? DISPLAY_FAMILY : webFontFamily;
  ctx.font = `${spec.fontWeight} ${px}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spec.letterSpacing ?? 0}px`;
  ctx.shadowColor = shadow ? withAlpha(cardColors.ink, 0.45) : 'transparent';
  ctx.shadowBlur = shadow ? 8 : 0;
  ctx.shadowOffsetY = shadow ? 2 : 0;
  let line = spec.uppercase ? value.toUpperCase() : value;
  if (ctx.measureText(line).width > maxWidth) {
    const chars = [...line];
    while (chars.length > 1 && ctx.measureText(`${chars.join('').trimEnd()}…`).width > maxWidth) {
      chars.pop();
    }
    line = `${chars.join('').trimEnd()}…`;
  }
  ctx.fillText(line, x, y);
  ctx.shadowColor = 'transparent';
};

/** Splits `value` into at most `lines` lines of `maxWidth`, the last one cut with "…". */
const wrapText = (
  ctx: CanvasRenderingContext2D,
  value: string,
  variant: CardTextVariant,
  maxWidth: number,
  lines: number,
) => {
  const spec = cardText[variant];
  ctx.font = `${spec.fontWeight} ${spec.fontSize}px ${webFontFamily}`;
  const out: string[] = [];
  let current = '';
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      out.push(current);
      current = word;
    } else current = next;
  }
  if (current) out.push(current);
  if (out.length > lines) out.splice(lines - 1, out.length, out.slice(lines - 1).join(' '));
  return out;
};

const lineHeight = (variant: CardTextVariant) => cardText[variant].lineHeight;

/** Rookie front: jersey number, crest wordmark, name, position/team, class/major/division. */
const drawFront = (ctx: CanvasRenderingContext2D, card: PreparedCard) => {
  const window = { x: L.photoInset, y: L.photoInset, w: W - L.photoInset * 2 };
  if (!card.photoUri) {
    drawText(ctx, card.initials, W / 2, window.y + L.photoHeight / 2, {
      variant: 'initials',
      color: withAlpha(cardColors.white, 0.92),
      maxWidth: window.w,
      align: 'center',
    });
  }
  if (card.jerseyDigits) {
    drawText(
      ctx,
      card.jerseyDigits,
      window.x + L.jerseyInsetX,
      window.y + L.jerseyInsetY + lineHeight('jersey') / 2,
      { variant: 'jersey', color: cardColors.white, maxWidth: window.w / 2, shadow: true },
    );
  }
  drawText(ctx, 'Team IMPACT', window.x + window.w - L.jerseyInsetX, window.y + L.jerseyInsetX, {
    variant: 'eyebrow',
    color: cardColors.yellow,
    maxWidth: window.w / 2,
    align: 'right',
    shadow: true,
  });

  const left = L.lowerPaddingX;
  const width = W - L.lowerPaddingX * 2;
  let y = PHOTO_BOTTOM + L.lowerPaddingY;
  const fit = card.nameFit;
  const nameLine = fit.fontSize * NAME_LINE_HEIGHT;
  for (const line of fit.lines) {
    drawText(ctx, line, left, y + nameLine / 2, {
      variant: 'rookieName',
      size: fit.fontSize,
      color: cardColors.white,
      maxWidth: width,
      shadow: true,
    });
    y += nameLine;
  }
  if (card.rookieLine) {
    y += L.rookieGap;
    drawText(ctx, card.rookieLine, left, y + lineHeight('rookieLine') / 2, {
      variant: 'rookieLine',
      color: cardColors.white,
      maxWidth: width,
    });
  }

  if (card.rookieStats.length === 0) return;
  // The row sits on the bottom edge, cells sized like the renderers' flex row: by content,
  // sharing out spare room or shrinking in proportion when there isn't enough.
  const gap = L.rookieGap * 2.5;
  const labelH = lineHeight('statLabel');
  const valueH = lineHeight('rookieValue');
  const rowTop = H - (L.lowerPaddingY + 4) - (L.rookieRowPadding + labelH + 2 + valueH);
  ctx.fillStyle = withAlpha(cardColors.white, 0.18);
  ctx.fillRect(left, rowTop, width, 1);
  const measure = (value: string, variant: CardTextVariant) => {
    const spec: CardTextStyle = cardText[variant];
    ctx.font = `${spec.fontWeight} ${spec.fontSize}px ${webFontFamily}`;
    return ctx.measureText(spec.uppercase ? value.toUpperCase() : value).width;
  };
  const basis = card.rookieStats.map((s) =>
    Math.max(measure(s.label, 'statLabel'), measure(s.value, 'rookieValue')),
  );
  const room = width - gap * (basis.length - 1);
  const total = basis.reduce((a, b) => a + b, 0);
  const widths =
    total <= room
      ? basis.map((b) => b + (room - total) / basis.length)
      : basis.map((b) => (b / total) * room);
  let x = left;
  card.rookieStats.forEach((stat, i) => {
    const w = widths[i] ?? 0;
    drawText(ctx, stat.label, x, rowTop + L.rookieRowPadding + labelH / 2, {
      variant: 'statLabel',
      color: cardColors.yellow,
      maxWidth: w,
    });
    drawText(ctx, stat.value, x, rowTop + L.rookieRowPadding + labelH + 2 + valueH / 2, {
      variant: 'rookieValue',
      color: cardColors.white,
      maxWidth: w,
    });
    x += w + gap;
  });
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

/** Back: avatar, name, experience rows, skills, about, facts and the season. No contact. */
const drawBack = (
  ctx: CanvasRenderingContext2D,
  card: PreparedCard,
  palette: CardPalette,
  avatar: HTMLImageElement | null,
) => {
  const pad = L.padding;
  const inner = W - pad * 2;
  const headerMid = pad + L.backHeader / 2;
  const r = L.avatar / 2;
  const cx = pad + r;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, headerMid, r, 0, Math.PI * 2);
  ctx.fillStyle = palette.glow;
  ctx.fill();
  if (avatar) {
    ctx.clip();
    const s = Math.max(L.avatar / avatar.width, L.avatar / avatar.height);
    const dw = avatar.width * s;
    const dh = avatar.height * s;
    ctx.drawImage(avatar, cx - dw / 2, headerMid - dh / 2, dw, dh);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, headerMid, r - L.photoBorder / 2, 0, Math.PI * 2);
  ctx.strokeStyle = cardColors.white;
  ctx.lineWidth = L.photoBorder;
  ctx.stroke();
  if (!avatar) {
    drawText(ctx, card.initials, cx, headerMid, {
      variant: 'badgeNumber',
      color: cardColors.white,
      maxWidth: L.avatar,
      align: 'center',
    });
  }

  const textX = pad + L.avatar + L.gap;
  const textW = W - pad - 8 - textX;
  const stack = [
    { value: 'Off the field', variant: 'eyebrow' as const, color: cardColors.yellow },
    { value: card.fullName, variant: 'name' as const, color: cardColors.white },
    ...(card.personalLine
      ? [
          {
            value: card.personalLine,
            variant: 'subtle' as const,
            color: withAlpha(cardColors.white, 0.75),
          },
        ]
      : []),
  ];
  let y = headerMid - stack.reduce((sum, t) => sum + lineHeight(t.variant), 0) / 2;
  for (const t of stack) {
    drawText(ctx, t.value, textX, y + lineHeight(t.variant) / 2, {
      variant: t.variant,
      color: t.color,
      maxWidth: textW,
    });
    y += lineHeight(t.variant);
  }

  y = pad + L.backHeader + L.gap;
  const eyebrow = (label: string) => {
    drawText(ctx, label, pad, y + lineHeight('eyebrow') / 2, {
      variant: 'eyebrow',
      color: palette.band,
      maxWidth: inner,
    });
    y += lineHeight('eyebrow') + L.rookieGap;
  };

  if (card.experience.length > 0) {
    eyebrow('Experience');
    const rowH = lineHeight('entryTitle');
    for (const entry of card.experience) {
      const mid = y + rowH / 2;
      ctx.fillStyle = palette.band;
      roundRect(ctx, pad, mid - 6, 3, 12, 2);
      ctx.fill();
      ctx.font = `${cardText.entryMeta.fontWeight} ${cardText.entryMeta.fontSize}px ${webFontFamily}`;
      const periodW = entry.period ? ctx.measureText(entry.period).width : 0;
      const titleX = pad + 3 + 8;
      const titleW = inner - 11 - (periodW ? periodW + 8 : 0);
      const title = entry.organization ? `${entry.role} · ${entry.organization}` : entry.role;
      drawText(ctx, title, titleX, mid, {
        variant: 'entryTitle',
        color: cardColors.ink,
        maxWidth: titleW,
      });
      if (entry.period) {
        drawText(ctx, entry.period, W - pad, mid, {
          variant: 'entryMeta',
          color: cardColors.inkMuted,
          maxWidth: periodW,
          align: 'right',
        });
      }
      y += rowH + L.rookieGap;
    }
    y += L.gap - L.rookieGap;
  }

  const chips = [...card.skills, ...card.interests];
  if (chips.length > 0) {
    const chipH = cardText.chip.lineHeight + L.chipPaddingY * 2;
    let x = pad;
    ctx.font = `${cardText.chip.fontWeight} ${cardText.chip.fontSize}px ${webFontFamily}`;
    for (const chip of chips) {
      const w = ctx.measureText(chip).width + L.chipPaddingX * 2;
      if (x + w > W - pad) break; // one row of whole chips, like the renderers
      roundRect(ctx, x, y, w, chipH, chipH / 2);
      ctx.fillStyle = withAlpha(cardColors.white, 0.6);
      ctx.fill();
      ctx.strokeStyle = palette.band;
      ctx.lineWidth = 1;
      ctx.stroke();
      drawText(ctx, chip, x + w / 2, y + chipH / 2, {
        variant: 'chip',
        color: palette.band,
        maxWidth: w,
        align: 'center',
      });
      x += w + L.rookieGap * 1.5;
    }
    y += chipH + L.gap;
  }

  if (card.bio) {
    eyebrow('About');
    for (const line of wrapText(ctx, card.bio, 'body', inner, 2)) {
      drawText(ctx, line, pad, y + lineHeight('body') / 2, {
        variant: 'body',
        color: cardColors.ink,
        maxWidth: inner,
      });
      y += lineHeight('body');
    }
    y += L.gap;
  }

  if (card.facts.length > 0) {
    const tileGap = L.rookieGap * 1.5;
    const tileW = (inner - tileGap * (card.facts.length - 1)) / card.facts.length;
    const tileH = 7 + lineHeight('statLabel') + 2 + lineHeight('factValue') + 7;
    card.facts.forEach((fact, i) => {
      const x = pad + i * (tileW + tileGap);
      roundRect(ctx, x, y, tileW, tileH, L.tileRadius);
      ctx.fillStyle = withAlpha(cardColors.white, 0.72);
      ctx.fill();
      drawText(ctx, fact.label, x + 10, y + 7 + lineHeight('statLabel') / 2, {
        variant: 'statLabel',
        color: cardColors.inkMuted,
        maxWidth: tileW - 20,
      });
      drawText(
        ctx,
        fact.value,
        x + 10,
        y + 7 + lineHeight('statLabel') + 2 + lineHeight('factValue') / 2,
        { variant: 'factValue', color: cardColors.ink, maxWidth: tileW - 20 },
      );
    });
  }

  if (card.seasonLine) {
    drawText(ctx, card.seasonLine, W / 2, H - pad - lineHeight('footer') / 2, {
      variant: 'footer',
      color: cardColors.inkMuted,
      maxWidth: inner,
      align: 'center',
    });
  }
};

const loadImage = (src: string, crossOrigin = false) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Couldn’t draw the card'));
    image.src = src;
  });

/**
 * The photo as a data URL, so it can sit inside the SVG and the canvas stays exportable. A photo
 * served without CORS can't be read; the card then shows initials, as it does with no photo.
 */
const photoDataUrl = async (url: string | null) => {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/** Waits (briefly) for the display font so the name isn't drawn in a fallback face. */
const fontsReady = async () => {
  try {
    await Promise.race([
      document.fonts?.load(`${cardText.rookieName.fontWeight} 34px ${DISPLAY_FAMILY}`),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // Fallback fonts are fine.
  }
};

/** Renders one face at `scale`× and resolves a PNG data URL. Web only. */
export const cardPng = async (face: CardFace, side: CardSide = 'front', scale = 3) => {
  const card = prepareCard(exportCardData(face));
  const palette = brandPalette;
  const photo = await photoDataUrl(card.photoUri);
  const preparedCard = { ...card, photoUri: photo };
  const [art, avatar] = await Promise.all([
    loadImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvg(preparedCard, side, photo, palette))}`,
    ),
    side === 'back' && photo ? loadImage(photo).catch(() => null) : Promise.resolve(null),
    fontsReady(),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas isn’t available here');
  ctx.scale(scale, scale);
  ctx.drawImage(art, 0, 0, W, H);
  if (side === 'front') drawFront(ctx, preparedCard);
  else drawBack(ctx, preparedCard, palette, avatar);
  return canvas.toDataURL('image/png');
};

/** Saves a data URL as a file through a temporary download link. Web only. */
export const download = (dataUrl: string, fileName: string) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
