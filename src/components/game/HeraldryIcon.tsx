import React from 'react';

interface HeraldryProps {
  colors: string[];
  pattern: 'stripes' | 'cross' | 'circles' | 'diagonal';
  className?: string;
}

export const HeraldryIcon: React.FC<HeraldryProps> = ({ colors, pattern, className }) => {
  const [c1, c2, c3] = colors;
  
  return (
    <svg viewBox="0 0 100 60" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="60" fill={c1} />
      {pattern === 'stripes' && (
        <>
          <rect y="20" width="100" height="20" fill={c2} />
          <rect y="40" width="100" height="20" fill={c3} />
        </>
      )}
      {pattern === 'cross' && (
        <>
          <rect x="40" width="20" height="60" fill={c2} />
          <rect y="20" width="100" height="20" fill={c2} />
          <rect x="45" width="10" height="60" fill={c3} />
          <rect y="25" width="100" height="10" fill={c3} />
        </>
      )}
      {pattern === 'diagonal' && (
        <>
          <polygon points="0,0 100,60 0,60" fill={c2} />
          <polygon points="100,0 100,60 0,0" fill={c3} opacity="0.5" />
        </>
      )}
      {pattern === 'circles' && (
        <>
          <circle cx="50" cy="30" r="20" fill={c2} />
          <circle cx="50" cy="30" r="10" fill={c3} />
        </>
      )}
    </svg>
  );
};
