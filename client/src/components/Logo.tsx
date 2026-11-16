/** The STACKS wordmark: the "A" is a tiny triangular bookshelf. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo" aria-label="STACKS">
      <svg width={size * 1.15} height={size} viewBox="0 0 32 28" fill="none" aria-hidden="true">
        <path d="M16 2L30 26H2L16 2Z" stroke="currentColor" className="logo-frame" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="5" y1="22" x2="27" y2="22" className="logo-frame" stroke="currentColor" strokeWidth="1.5" />
        <line x1="9" y1="15" x2="23" y2="15" className="logo-frame" stroke="currentColor" strokeWidth="1.5" />
        <rect x="7" y="17" width="2.5" height="5" fill="#e8a85a" rx="0.3" />
        <rect x="10.5" y="16" width="2" height="6" fill="#f5f0e8" rx="0.3" />
        <rect x="13.5" y="17.5" width="2.5" height="4.5" fill="#9b3a1e" rx="0.3" />
        <rect x="17" y="16.5" width="2" height="5.5" fill="#4a6741" rx="0.3" />
        <rect x="20" y="17" width="2.5" height="5" fill="#c8873a" rx="0.3" />
        <rect x="23.5" y="16" width="2" height="6" fill="#e8a85a" rx="0.3" />
        <rect x="10.5" y="10" width="2" height="5" fill="#f5f0e8" rx="0.3" />
        <rect x="13.5" y="10.5" width="2.5" height="4.5" fill="#c8873a" rx="0.3" />
        <rect x="17" y="10" width="2" height="5" fill="#9b3a1e" rx="0.3" />
        <rect x="20" y="10.5" width="2" height="4.5" fill="#4a6741" rx="0.3" />
      </svg>
      <span className="logo-word">
        ST<span className="logo-a">A</span>CKS
      </span>
    </span>
  );
}
