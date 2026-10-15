import type { CardFace } from '@team-impact/contracts';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  brandPalette,
  cardColors,
  frontArt,
  webFontFamily,
} from '@team-impact/ui-primitives/native';

/**
 * Web-only PNG export of a card's front: the same generated artwork as the card primitive
 * (`frontArt`) plus the face's text, drawn as an SVG and rasterised on a <canvas>. Native export
 * needs a view snapshot module (not installed yet), so the screen offers this on web only.
 *
 * Callers pass a face from `POST /cards/me/export`, which never carries contact details and only
 * exists for athletes' published cards, so a child's profile can't end up in an export.
 */

/** Card text is user-written: escape it so it can only ever be text inside the SVG. */
const xml = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export const cardSvg = (face: CardFace) => {
  const art = frontArt(face.athleteId, brandPalette);
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

  const text = (
    x: number,
    y: number,
    size: number,
    weight: number,
    fill: string,
    value: string,
    anchor = 'start',
    opacity = 1,
  ) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}" font-family='${webFontFamily}'>${xml(value)}</text>`;

  const initials = `${face.firstName.charAt(0)}${face.lastName.charAt(0)}`.toUpperCase();
  const teamLine = [face.team?.sport, face.team?.college.name].filter(Boolean).join(' · ');
  const meta = [face.position, `Class of ${face.classYear}`, face.major]
    .filter(Boolean)
    .join(' · ');
  const first = face.experience[0];
  const experience = first ? [first.role, first.organization].filter(Boolean).join(' · ') : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${art.gradient[0]}"/><stop offset="1" stop-color="${art.gradient[1]}"/></linearGradient>
${art.glow ? `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${art.glow.color}" stop-opacity="${art.glow.opacity}"/><stop offset="1" stop-color="${art.glow.color}" stop-opacity="0"/></radialGradient>` : ''}
${art.clip ? `<clipPath id="clip"><path d="${art.clip}"/></clipPath>` : ''}
</defs>
<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="22" fill="url(#bg)"/>
${art.glow ? `<circle cx="${art.glow.cx}" cy="${art.glow.cy}" r="${art.glow.r}" fill="url(#glow)"/>` : ''}
${plain}${clipped ? `<g clip-path="url(#clip)">${clipped}</g>` : ''}
${text(22, 40, 12, 700, cardColors.yellow, 'TEAM IMPACT')}
${face.jerseyNumber ? text(298, 44, 26, 800, cardColors.white, `#${face.jerseyNumber}`, 'end') : ''}
${text(160, 230, 120, 800, cardColors.white, initials, 'middle', 0.18)}
${text(22, 330, 30, 800, cardColors.white, clip(face.firstName.toUpperCase(), 18))}
${text(22, 362, 30, 800, cardColors.white, clip(face.lastName.toUpperCase(), 18))}
${teamLine ? text(22, 388, 13, 700, cardColors.yellow, clip(teamLine, 42)) : ''}
${text(22, 410, 12, 500, cardColors.white, clip(meta, 46))}
${experience ? text(22, 432, 12, 500, cardColors.white, clip(experience, 46), 'start', 0.85) : ''}
${face.skills.length ? text(22, 454, 11, 600, cardColors.white, clip(face.skills.slice(0, 5).join(' · '), 50), 'start', 0.85) : ''}
${text(298, 482, 10, 600, cardColors.white, `BASEBALL CARD · ${face.season}`, 'end', 0.7)}
</svg>`;
};

/** Renders the face at `scale`× and resolves a PNG data URL. Web only. */
export const cardPng = (face: CardFace, scale = 3) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = CARD_WIDTH * scale;
      canvas.height = CARD_HEIGHT * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas isn’t available here'));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Couldn’t draw the card'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvg(face))}`;
  });

/** Saves a data URL as a file through a temporary download link. Web only. */
export const download = (dataUrl: string, fileName: string) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
