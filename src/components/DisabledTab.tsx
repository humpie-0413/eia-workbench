import { useState } from 'react';

export default function DisabledTab({ label, tooltip }: { label: string; tooltip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-disabled="true"
        onClick={() => setShow((s) => !s)}
        onBlur={() => setShow(false)}
        className="h-9 cursor-not-allowed border-b-2 border-transparent px-4 text-text-tertiary"
      >
        {label}
      </button>
      {show && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-border bg-surface p-2 text-small text-text-secondary shadow-sm"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}
