import { DRAFT_DISPLAY_BASE_PATH, DRAFT_DISPLAY_OPERATIONS } from '../types/draft-display';

export type DraftStage = 'draft' | 'strategy';

export function buildDraftListPath(stage: DraftStage): string {
  const op =
    stage === 'draft'
      ? DRAFT_DISPLAY_OPERATIONS.draftList
      : DRAFT_DISPLAY_OPERATIONS.strategyList;
  return `${DRAFT_DISPLAY_BASE_PATH}/${op}`;
}

export function buildDetailPath(stage: DraftStage): string {
  const op =
    stage === 'draft'
      ? DRAFT_DISPLAY_OPERATIONS.draftDetail
      : DRAFT_DISPLAY_OPERATIONS.strategyDetail;
  return `${DRAFT_DISPLAY_BASE_PATH}/${op}`;
}

export const WIND_BIZ_GUBN_CODES = ['C', 'L'] as const;
export const WIND_SEARCH_TEXTS = ['풍력', '육상풍력'] as const;
