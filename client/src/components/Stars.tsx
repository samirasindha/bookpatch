import { Icon } from "./Icon";

export function StarInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={value && n <= value ? "on" : ""}
          // Clicking the current rating again clears it
          onClick={() => onChange(value === n ? null : n)}
        >
          <Icon name="star" size={26} fill={value && n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

export function StarDisplay({ value }: { value: number }) {
  return (
    <span className="stars-static" role="img" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" size={13} fill={n <= value ? "currentColor" : "none"} />
      ))}
    </span>
  );
}
