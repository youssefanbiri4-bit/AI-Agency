export function WavingRobot() {
  return (
    <div className="waving-robot" aria-label="AgentFlow AI assistant waving">
      <svg viewBox="0 0 220 180" role="img" className="h-full w-full">
        <defs>
          <linearGradient id="robotBody" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#D5E5E5" />
          </linearGradient>
          <linearGradient id="robotAccent" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#F7CBCA" />
            <stop offset="100%" stopColor="#F7CBCA" />
          </linearGradient>
        </defs>
        <ellipse cx="112" cy="158" rx="62" ry="12" fill="rgba(93,107,107,0.12)" />
        <g className="robot-float">
          <path
            d="M74 73c0-24 18-42 42-42s42 18 42 42v38c0 25-18 43-42 43s-42-18-42-43V73Z"
            fill="url(#robotBody)"
            stroke="#5D6B6B"
            strokeOpacity="0.12"
            strokeWidth="3"
          />
          <path
            d="M84 82c0-19 13-31 32-31s32 12 32 31v17c0 19-13 31-32 31S84 118 84 99V82Z"
            fill="#5D6B6B"
            fillOpacity="0.92"
          />
          <circle cx="104" cy="90" r="7" fill="#D5E5E5" />
          <circle cx="128" cy="90" r="7" fill="#D5E5E5" />
          <path
            d="M104 111c7 5 17 5 24 0"
            fill="none"
            stroke="#D5E5E5"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            d="M116 31V16"
            stroke="#5D6B6B"
            strokeLinecap="round"
            strokeOpacity="0.52"
            strokeWidth="5"
          />
          <circle cx="116" cy="12" r="7" fill="url(#robotAccent)" />
          <path
            d="M76 105H55c-8 0-14 6-14 14v13"
            fill="none"
            stroke="#5D6B6B"
            strokeLinecap="round"
            strokeOpacity="0.28"
            strokeWidth="10"
          />
          <g className="robot-wave">
            <path
              d="M158 100h15c10 0 18-8 18-18V60"
              fill="none"
              stroke="#5D6B6B"
              strokeLinecap="round"
              strokeOpacity="0.32"
              strokeWidth="10"
            />
            <circle cx="191" cy="54" r="12" fill="url(#robotAccent)" />
          </g>
          <rect x="93" y="137" width="46" height="10" rx="5" fill="url(#robotAccent)" />
        </g>
      </svg>
    </div>
  );
}
