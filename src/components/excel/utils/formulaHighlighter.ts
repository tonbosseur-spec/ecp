import React from 'react';

export interface HighlightedReference {
  ref: string;
  start: number;
  end: number;
  textColorClass: string;
  gridColorClass: string;
}

const HIGHLIGHT_COLORS = [
  { text: 'text-blue-600 font-bold', grid: 'bg-blue-500/20 border-2 border-blue-500 text-blue-950 font-semibold' },
  { text: 'text-emerald-600 font-bold', grid: 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-950 font-semibold' },
  { text: 'text-amber-600 font-bold', grid: 'bg-amber-500/20 border-2 border-amber-500 text-amber-950 font-semibold' },
  { text: 'text-purple-600 font-bold', grid: 'bg-purple-500/20 border-2 border-purple-500 text-purple-950 font-semibold' },
  { text: 'text-rose-600 font-bold', grid: 'bg-rose-500/20 border-2 border-rose-500 text-rose-950 font-semibold' },
  { text: 'text-indigo-600 font-bold', grid: 'bg-indigo-500/20 border-2 border-indigo-500 text-indigo-950 font-semibold' },
  { text: 'text-cyan-600 font-bold', grid: 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-950 font-semibold' },
];

export function extractFormulaReferences(formula: string): HighlightedReference[] {
  if (!formula || !formula.startsWith('=')) return [];

  // Match range (A1:B2) or single cell (A1), with optional $ signs
  // Excludes functions ending with numbers followed by '(' via lookahead (?!\()
  const regex = /(?<![A-Za-z0-9_])(\$?[A-Za-z]{1,3}\$?[0-9]+:\$?[A-Za-z]{1,3}\$?[0-9]+|\$?[A-Za-z]{1,3}\$?[0-9]+)(?!\()/gi;
  
  const matches: HighlightedReference[] = [];
  let match;
  
  const uniqueRefs = new Map<string, number>();
  let colorIndex = 0;

  while ((match = regex.exec(formula)) !== null) {
    const rawRef = match[0];
    const cleanRefUpper = rawRef.replace(/\$/g, '').toUpperCase();
    
    if (!uniqueRefs.has(cleanRefUpper)) {
      uniqueRefs.set(cleanRefUpper, colorIndex % HIGHLIGHT_COLORS.length);
      colorIndex++;
    }
    
    const cIndex = uniqueRefs.get(cleanRefUpper)!;
    const color = HIGHLIGHT_COLORS[cIndex];
    
    matches.push({
      ref: rawRef,
      start: match.index,
      end: match.index + rawRef.length,
      textColorClass: color.text,
      gridColorClass: color.grid,
    });
  }

  return matches;
}

export function renderHighlightedText(value: string, highlights: HighlightedReference[]): React.ReactNode {
  if (!highlights || highlights.length === 0) return value;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  const sorted = [...highlights].sort((a, b) => a.start - b.start);

  sorted.forEach((hl, i) => {
    if (hl.start > lastIndex) {
      elements.push(React.createElement('span', { key: `text-${i}` }, value.substring(lastIndex, hl.start)));
    }
    elements.push(
      React.createElement('span', { key: `hl-${i}`, className: hl.textColorClass }, value.substring(hl.start, hl.end))
    );
    lastIndex = hl.end;
  });

  if (lastIndex < value.length) {
    elements.push(React.createElement('span', { key: 'text-end' }, value.substring(lastIndex)));
  }

  return React.createElement(React.Fragment, null, elements);
}
