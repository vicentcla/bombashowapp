import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

export function PercusionIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Drum body */}
      <ellipse cx="12" cy="13" rx="8" ry="3" />
      <line x1="4" y1="13" x2="4" y2="18" />
      <line x1="20" y1="13" x2="20" y2="18" />
      <ellipse cx="12" cy="18" rx="8" ry="3" />
      {/* Drum sticks */}
      <line x1="8" y1="3" x2="11" y2="11" strokeWidth="2.5" />
      <line x1="16" y1="3" x2="13" y2="11" strokeWidth="2.5" />
      <circle cx="8" cy="2.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="2.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TrombonIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Mouthpiece */}
      <line x1="2" y1="5" x2="7" y2="5" />
      {/* Main tube top */}
      <line x1="7" y1="5" x2="16" y2="5" />
      {/* Bend down */}
      <path d="M16 5 Q19 5 19 8" />
      {/* Slide outer tube down */}
      <line x1="19" y1="8" x2="19" y2="17" />
      {/* Bottom bend */}
      <path d="M19 17 Q19 20 16 20" />
      {/* Return tube */}
      <line x1="16" y1="20" x2="9" y2="20" />
      {/* Bell bend */}
      <path d="M9 20 Q6 20 6 17" />
      {/* Bell flare */}
      <path d="M6 17 Q6 11 9 11" strokeWidth="1.5"/>
      {/* Slide inner tube */}
      <line x1="16" y1="8" x2="16" y2="17" strokeWidth="1.5" strokeDasharray="2 1" />
    </svg>
  );
}

export function TrompetaIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Mouthpiece */}
      <line x1="2" y1="12" x2="5" y2="12" />
      {/* Body / lead pipe */}
      <line x1="5" y1="12" x2="10" y2="12" />
      {/* Valve cluster (3 valves) */}
      <rect x="10" y="10" width="2" height="4" rx="0.5" />
      <rect x="13" y="10" width="2" height="4" rx="0.5" />
      <rect x="16" y="10" width="2" height="4" rx="0.5" />
      {/* Tubing loop top */}
      <path d="M10 10 Q10 6 14 6 Q18 6 18 10" strokeWidth="1.5"/>
      {/* Bell taper */}
      <path d="M18 12 Q20 12 21 11" />
      <path d="M18 12 Q20 12 22 14" />
      <path d="M21 11 Q23 11 22 14" />
    </svg>
  );
}

export function SaxoIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Neck / mouthpiece */}
      <path d="M8 2 Q8 5 11 6" />
      {/* Body curve */}
      <path d="M11 6 Q16 7 17 11 Q18 16 15 19" />
      {/* Bell */}
      <path d="M15 19 Q12 22 9 21 Q7 20 8 18" />
      <path d="M8 18 Q9 16 11 16 Q13 17 12 19" strokeWidth="1.5"/>
      {/* Keys (small circles) */}
      <circle cx="14" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="16" r="1" fill="currentColor" stroke="none" />
      {/* Mouthpiece tip */}
      <line x1="6" y1="2" x2="9" y2="2" />
    </svg>
  );
}

export function SousaphoneIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Main circular coil */}
      <circle cx="12" cy="13" r="7" />
      {/* Inner hole */}
      <circle cx="12" cy="13" r="3.5" />
      {/* Mouthpiece tube going up-left */}
      <path d="M7 7 Q5 4 3 3" />
      <line x1="2" y1="2" x2="4" y2="4" />
      {/* Bell (large opening at bottom right) */}
      <path d="M17 17 Q20 19 21 22" strokeWidth="2.5" />
      <path d="M19 21 Q22 20 22 23" strokeWidth="1.5"/>
    </svg>
  );
}
