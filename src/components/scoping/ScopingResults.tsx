import { useCallback, useEffect, useState } from 'react';
import type {
  ScopingResult,
  ScopingRuleCategory,
  ScopingSkipReason
} from '@/lib/types/analysis-result';
import { exportResultsToCsv } from '@/features/scoping/csv-export';
import { exportResultsToMarkdown } from '@/features/scoping/markdown-export';
import { buildManualAnalysisPrompt } from '@/features/scoping/prompt-generator';
import { pushToast } from '../toast-store';

interface ApiRun {
  id: string;
  rule_pack_version: string;
  input: Record<string, unknown>;
  results: ScopingResult[];
  created_at: string;
}

const SKIP_LABEL: Record<ScopingSkipReason, string> = {
  input_undefined: '입력 미기재 — 해당 항목은 사용자가 값을 채우기 전까지 보류합니다.',
  zone_mismatch: '용도지역이 해당 규칙 범위 밖입니다.',
  condition_not_met: '해당 임계값에 도달하지 않았습니다.'
};

const CATEGORY_BADGE: Record<ScopingRuleCategory, { label: string; text: string; bg: string }> = {
  eia_target: { label: '본 평가 대상 가능성', text: '#991B1B', bg: '#FEE2E2' },
  small_eia: { label: '소규모 평가 대상 가능성', text: '#9A3412', bg: '#FFEDD5' },
  forest_conversion: { label: '산지전용 협의 필요 가능성', text: '#166534', bg: '#DCFCE7' }
};

export interface ScopingResultsProps {
  projectId: string;
}

export default function ScopingResults({ projectId }: ScopingResultsProps) {
  const [run, setRun] = useState<ApiRun | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/scoping`);
      if (!res.ok) return;
      const j = (await res.json()) as { run: ApiRun | null };
      setRun(j.run);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
    const onRun = (e: Event) => {
      const ce = e as CustomEvent<{
        runId: string;
        rule_pack_version: string;
        results: ScopingResult[];
      }>;
      if (!ce.detail) return;
      setRun({
        id: ce.detail.runId,
        rule_pack_version: ce.detail.rule_pack_version,
        input: {},
        results: ce.detail.results,
        created_at: new Date().toISOString()
      });
    };
    const onLoadRun = (e: Event) => {
      const ce = e as CustomEvent<{ run: ApiRun }>;
      if (ce.detail?.run) setRun(ce.detail.run);
    };
    window.addEventListener('scoping:run', onRun);
    window.addEventListener('scoping:load-run', onLoadRun);
    return () => {
      window.removeEventListener('scoping:run', onRun);
      window.removeEventListener('scoping:load-run', onLoadRun);
    };
  }, [load]);

  if (loading) return <p className="text-small text-text-tertiary">불러오는 중…</p>;
  if (!run) {
    return (
      <div className="rounded-md border border-border bg-surface p-6 text-small text-text-secondary">
        아직 실행된 검토가 없습니다. 좌측 입력 폼을 채우고 "검토 실행"을 누르세요.
      </div>
    );
  }

  const triggered = run.results.filter((r) => r.triggered);
  const skipped = run.results.filter((r) => !r.triggered);

  async function copyPrompt() {
    const prompt = buildManualAnalysisPrompt({
      input: run!.input,
      results: run!.results,
      rulePackVersion: run!.rule_pack_version
    });
    try {
      await navigator.clipboard.writeText(prompt);
      pushToast('info', 'Claude 분석 프롬프트를 클립보드에 복사했습니다.');
    } catch {
      pushToast('error', '클립보드 복사에 실패했습니다. 브라우저 권한을 확인하세요.');
    }
  }

  function downloadCsv() {
    const csv = exportResultsToCsv(run!.results);
    downloadBlob(csv, 'text/csv;charset=utf-8', `scoping-${run!.id}.csv`);
  }

  function downloadMarkdown() {
    const md = exportResultsToMarkdown({
      input: run!.input,
      results: run!.results,
      rulePackVersion: run!.rule_pack_version,
      createdAt: run!.created_at
    });
    downloadBlob(md, 'text/markdown;charset=utf-8', `scoping-${run!.id}.md`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-text-tertiary">
          실행 ID <code className="font-mono">{run.id}</code> · rule pack{' '}
          <span data-testid="rule-pack-version">{run.rule_pack_version}</span> ·{' '}
          {new Date(run.created_at).toLocaleString('ko-KR')}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyPrompt}
            className="h-8 rounded-md border border-border px-3 text-small hover:bg-bg"
          >
            Claude 분석 프롬프트 복사
          </button>
          <button
            type="button"
            onClick={downloadMarkdown}
            className="h-8 rounded-md border border-border px-3 text-small hover:bg-bg"
          >
            Markdown 내보내기
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="h-8 rounded-md border border-border px-3 text-small hover:bg-bg"
          >
            CSV 내보내기
          </button>
        </div>
      </div>

      <section aria-label="발동된 규칙" className="space-y-3">
        <h2 className="text-h2">
          발동 <span className="text-text-tertiary">({triggered.length})</span>
        </h2>
        {triggered.length === 0 ? (
          <p className="text-small text-text-secondary">
            발동된 규칙이 없습니다. 아래 "스킵"에서 개별 사유를 확인하세요.
          </p>
        ) : (
          triggered.map((r) => <ResultCard key={r.ruleId} result={r} triggered />)
        )}
      </section>

      <section aria-label="스킵된 규칙" className="space-y-3">
        <details className="rounded-md border border-border bg-surface">
          <summary className="cursor-pointer px-4 py-2 text-h2">
            스킵 / 해당 아님 <span className="text-text-tertiary">({skipped.length})</span>
          </summary>
          <div className="space-y-3 border-t border-border p-4">
            {skipped.map((r) => (
              <ResultCard key={r.ruleId} result={r} triggered={false} />
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}

function ResultCard({ result, triggered }: { result: ScopingResult; triggered: boolean }) {
  const badge = CATEGORY_BADGE[result.category];
  return (
    <article className="rounded-md border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-h2">{result.title}</h3>
        {triggered ? (
          <span
            className="rounded px-2 py-0.5 text-small font-semibold"
            style={{ color: badge.text, backgroundColor: badge.bg }}
          >
            {badge.label}
          </span>
        ) : (
          <span className="rounded bg-bg px-2 py-0.5 text-small text-text-secondary">
            {result.skip_reason ? SKIP_LABEL[result.skip_reason].split(' —')[0] : '해당 아님'}
          </span>
        )}
        <span
          aria-label="사람 검토 필요 표시"
          className="rounded bg-bg px-2 py-0.5 text-small text-text-primary"
        >
          사람 검토 필요
        </span>
      </div>
      {result.skip_reason ? (
        <p className="mb-2 text-small text-text-secondary">{SKIP_LABEL[result.skip_reason]}</p>
      ) : null}
      <dl className="grid gap-2 text-small">
        <div>
          <dt className="inline font-semibold text-text-secondary">근거: </dt>
          <dd className="inline">
            {result.basis.length === 0 ? (
              <span className="text-text-tertiary">근거 참조 없음</span>
            ) : (
              result.basis.map((c, i) => (
                <span key={c.id}>
                  {c.refLink ? (
                    <a
                      href={c.refLink}
                      className="text-primary hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {c.title}
                    </a>
                  ) : (
                    c.title
                  )}
                  {i < result.basis.length - 1 ? ', ' : ''}
                </span>
              ))
            )}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold text-text-secondary">가정: </dt>
          <dd className="inline">
            {result.assumptions.length > 0 ? result.assumptions.join(' / ') : '명시된 가정 없음'}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold text-text-secondary">한계: </dt>
          <dd className="inline">
            {result.limits.length > 0 ? result.limits.join(' / ') : '현지조사·전문가 확인 필요'}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function downloadBlob(text: string, type: string, filename: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
