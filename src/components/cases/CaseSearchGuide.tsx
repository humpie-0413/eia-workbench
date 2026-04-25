export default function CaseSearchGuide() {
  return (
    <details className="rounded-md border border-border bg-surface p-3 text-small text-text-secondary">
      <summary className="cursor-pointer">검색 가이드</summary>
      <p className="mt-2">
        사업명에 공백이 없는 경우 어두만 매칭됩니다. "강원풍력"은 "강원"으로 찾을 수 있지만
        "풍력"으로는 찾을 수 없습니다. 짧은 검색어(3자 이하)는 부분일치를 함께 시도합니다.
      </p>
    </details>
  );
}
