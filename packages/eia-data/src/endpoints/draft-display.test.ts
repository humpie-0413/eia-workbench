import { describe, it, expect } from 'vitest';
import { buildDraftListPath, buildDetailPath } from './draft-display';
import { DRAFT_DISPLAY_BASE_PATH, DRAFT_DISPLAY_OPERATIONS } from '../types/draft-display';

describe('draft-display endpoint helpers', () => {
  it('builds list path with operation', () => {
    expect(buildDraftListPath('draft')).toBe(
      `${DRAFT_DISPLAY_BASE_PATH}/${DRAFT_DISPLAY_OPERATIONS.draftList}`
    );
    expect(buildDraftListPath('strategy')).toBe(
      `${DRAFT_DISPLAY_BASE_PATH}/${DRAFT_DISPLAY_OPERATIONS.strategyList}`
    );
  });
  it('builds detail path', () => {
    expect(buildDetailPath('draft')).toContain(DRAFT_DISPLAY_OPERATIONS.draftDetail);
    expect(buildDetailPath('strategy')).toContain(DRAFT_DISPLAY_OPERATIONS.strategyDetail);
  });
});
