import React from 'react';

export default function TeamBadge({ abbr, name, logo, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 flex-1 transition text-left ${
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent'
      }`}
    >
      {logo && <img src={logo} alt={abbr} className="w-7 h-7 object-contain shrink-0" />}
      <div className="min-w-0">
        <div className="font-semibold text-sm leading-tight">{abbr}</div>
        <div className="text-xs opacity-80 truncate max-w-[140px]">{name}</div>
      </div>
    </button>
  );
}