interface TopicInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  cta?: string;
}

/** Topic entry field + start button. Submits on Enter or button click. */
export function TopicInput({
  value,
  onChange,
  onSubmit,
  disabled,
  cta = "⚔️ Start Duel",
}: TopicInputProps) {
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit();
      }}
    >
      <input
        className="min-w-0 flex-1 rounded-xl border border-fieldEdge bg-field px-4 py-3.5 text-base text-white outline-none placeholder:text-faint focus:border-yes disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type a debate topic…"
        disabled={disabled}
        aria-label="Debate topic"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="whitespace-nowrap rounded-xl bg-gradient-to-r from-yes to-no px-6 py-3.5 text-base font-bold text-white transition hover:brightness-110 disabled:cursor-default disabled:brightness-75 disabled:grayscale"
      >
        {cta}
      </button>
    </form>
  );
}
