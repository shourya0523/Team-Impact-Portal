import type { CardFace } from '@team-impact/contracts';
import type { AthleteCardData } from '@team-impact/ui-primitives/native';
import { toCardData } from '@/components/cardData';

/**
 * What an exported card shows: the published face with no contact details (exports never carry
 * them, PRD A8) plus the rookie front's fields.
 */
export const exportCardData = (face: CardFace): AthleteCardData => toCardData(face);

/** "jordan-lee-impact-card-2026.png" → "…-back.png" for the back face. */
export const fileNameFor = (fileName: string, side: 'front' | 'back') =>
  side === 'front' ? fileName : `${fileName.replace(/\.png$/i, '')}-back.png`;
