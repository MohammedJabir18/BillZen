import { useRef, type ReactNode } from 'react';
import { useNavigationCapsule } from '../hooks/useNavigationCapsule';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  testId: string;
}
interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  language: string;
  testId?: string;
  className?: string;
}

/** Shares navigation motion while retaining native toggle-button focus and names. */
export function AnimatedSegmentedControl<T extends string>({
  value, onChange, options, label, language, testId, className = '',
}: Props<T>) {
  const root = useRef<HTMLDivElement>(null);
  const capsule = useRef<HTMLDivElement>(null);
  useNavigationCapsule(root, capsule, options.find(option => option.value === value)?.testId || '', language);

  return (
    <div ref={root} role="group" aria-label={label} data-testid={testId}
      className={`relative isolate flex flex-wrap gap-1 rounded-xl bg-surface-subtle border border-border-subtle p-1 min-w-0 ${className}`}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const current = options.findIndex(option =>
          option.testId === (event.target as HTMLElement).closest('button')?.dataset.testid);
        if (current < 0) return;
        const rtl = root.current && getComputedStyle(root.current).direction === 'rtl';
        const delta = (event.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
          : (current + delta + options.length) % options.length;
        event.preventDefault();
        onChange(options[index].value);
        root.current?.querySelector<HTMLButtonElement>(`[data-testid="${options[index].testId}"]`)?.focus();
      }}>
      <div ref={capsule} data-segmented-capsule aria-hidden="true"
        className="absolute inset-0 z-0 bg-[var(--brand-lime)] dark:bg-[#2e5733] pointer-events-none transition-none"
        style={{ clipPath: 'inset(0 100% 100% 0)' }} />
      {options.map(option => (
        <button key={option.value} type="button" data-testid={option.testId} aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`relative z-10 flex-1 min-w-0 min-h-11 px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 focus-ring active:scale-[.975] ${value === option.value ? 'text-text-main dark:text-[#ceeaa0]' : 'text-text-muted hover:text-text-main'}`}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
