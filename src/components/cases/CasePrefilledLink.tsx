export default function CasePrefilledLink({
  sido,
  capacityBand
}: {
  sido?: string | null;
  capacityBand?: string | null;
}) {
  const params = new URLSearchParams();
  if (sido) params.set('sido', sido);
  if (capacityBand) params.set('capacity_band', capacityBand);
  const href = params.toString() ? `/cases?${params.toString()}` : '/cases';
  return (
    <a
      href={href}
      className="inline-flex h-9 items-center rounded-md border border-border px-3 text-small hover:bg-bg"
    >
      유사사례 보기
    </a>
  );
}
