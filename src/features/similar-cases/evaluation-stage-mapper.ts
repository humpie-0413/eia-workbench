// src/features/similar-cases/evaluation-stage-mapper.ts
import type { DscssIngDetailItem } from '../../../packages/eia-data/src/types/discussion';

export type EvaluationStage = '본안' | '전략' | 'unknown';

function compareDescStr(a?: string, b?: string): number {
  if (a && b) return b.localeCompare(a);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function sortItems(items: DscssIngDetailItem[]): DscssIngDetailItem[] {
  // resReplyDt DESC → applyDt DESC → API order (stable)
  return [...items]
    .map((item, idx) => ({ item, idx }))
    .sort((x, y) => {
      const c1 = compareDescStr(x.item.resReplyDt, y.item.resReplyDt);
      if (c1 !== 0) return c1;
      const c2 = compareDescStr(x.item.applyDt, y.item.applyDt);
      if (c2 !== 0) return c2;
      return x.idx - y.idx;
    })
    .map((w) => w.item);
}

function classify(stateNm: string): EvaluationStage {
  // 우선순위 ① '전략' ② '본안' / '협의' (strict) / '변경협의' (substring) ③ 그 외 (spec §4.3 / OH P1 Q4)
  // '협의' 는 strict equality — '협의취하' / '협의불가' / '협의보류' 등 negative 의미 텍스트 오분류 방지.
  if (stateNm.includes('전략')) return '전략';
  if (stateNm.includes('본안') || stateNm === '협의' || stateNm.includes('변경협의')) return '본안';
  return 'unknown';
}

export function mapEvaluationStage(items: DscssIngDetailItem[] | undefined): EvaluationStage {
  if (!items || items.length === 0) return 'unknown';
  const sorted = sortItems(items);
  const first = sorted[0];
  if (!first) return 'unknown';
  return classify(first.stateNm);
}
