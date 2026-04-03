export function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6 4l4 4-4 4" stroke="#6a7282" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CircleActive() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="8" stroke="#05df72" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="4" fill="#05df72" />
    </svg>
  );
}

export function CircleInactive() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="8" stroke="#6a7282" strokeWidth="1.5" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"
        stroke="#05df72"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="#05df72" strokeWidth="1.2" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4.5 4.6C2.9 5.7 1.5 8 1.5 8s2.5 5 6.5 5c1.1 0 2.1-.3 3-.7M7 3.1c.3 0 .7-.1 1-.1 4 0 6.5 5 6.5 5s-.5 1-1.5 2.3"
        stroke="#6a7282"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.5" stroke="#d1d5dc" strokeWidth="1.2" />
      <path d="M8 5v3l2 1.5" stroke="#d1d5dc" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="8.5" stroke="#05df72" strokeWidth="1.2" />
      <path d="M6.5 10l2.5 2.5 4.5-5" stroke="#05df72" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LogoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="10" width="3" height="8" rx="1" fill="white" />
      <rect x="8.5" y="5" width="3" height="13" rx="1" fill="white" />
      <rect x="15" y="2" width="3" height="16" rx="1" fill="white" />
    </svg>
  );
}
