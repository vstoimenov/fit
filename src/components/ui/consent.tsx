"use client";

export function Consent({
  checked,
  onChange,
  name,
  children,
}: {
  name?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 gap-3 py-2.5 text-sm leading-snug">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ember)]"
      />
      <span>{children}</span>
    </label>
  );
}
