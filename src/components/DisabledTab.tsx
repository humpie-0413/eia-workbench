import { useState } from 'react';

export default function DisabledTab({ label, tooltip }: { label: string; tooltip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <button type="button" aria-disabled="true"
              onClick={() => setShow((s) => !s)}
              onBlur={() => setShow(false)}
              className="h-9 px-4 border-b-2 border-transparent text-text-tertiary cursor-not-allowed">
        {label}
      </button>
      {show && (
        <span role="tooltip"
              className="absolute left-0 top-full mt-1 z-10 w-64 p-2 rounded-md border border-border bg-surface text-small text-text-secondary shadow-sm">
          {tooltip}
        </span>
      )}
    </span>
  );
}
