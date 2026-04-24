import { useId } from 'react';
import type { AreaUnit } from '@/features/scoping/units';

export interface AreaInputProps {
  label: string;
  value: string;
  unit: AreaUnit;
  onValueChange: (v: string) => void;
  onUnitChange: (u: AreaUnit) => void;
  required?: boolean;
  placeholder?: string;
  describedById?: string;
}

export default function AreaInput({
  label,
  value,
  unit,
  onValueChange,
  onUnitChange,
  required,
  placeholder,
  describedById
}: AreaInputProps) {
  const inputId = useId();
  const unitId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-small font-semibold text-text-primary">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        ) : null}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          placeholder={placeholder}
          aria-required={required ? 'true' : undefined}
          aria-describedby={describedById}
          onChange={(e) => onValueChange(e.target.value)}
          className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-body"
        />
        <label htmlFor={unitId} className="sr-only">
          {label} 단위
        </label>
        <select
          id={unitId}
          value={unit}
          onChange={(e) => onUnitChange(e.target.value as AreaUnit)}
          className="h-9 rounded-md border border-border bg-surface px-2 text-body"
        >
          <option value="sqm">㎡</option>
          <option value="ha">ha</option>
        </select>
      </div>
    </div>
  );
}
