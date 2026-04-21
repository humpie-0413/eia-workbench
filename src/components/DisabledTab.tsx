export default function DisabledTab({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected="false"
      aria-disabled="true"
      title={tooltip}
      className="h-9 cursor-not-allowed border-b-2 border-transparent px-4 text-text-tertiary"
    >
      {label}
    </button>
  );
}
