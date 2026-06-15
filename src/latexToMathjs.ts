function extractBraceGroup(s: string, start: number): { content: string; end: number } | null {
	if (start >= s.length || s[start] !== '{') return null;
	let depth = 0;
	for (let i = start; i < s.length; i++) {
		if (s[i] === '{') depth++;
		else if (s[i] === '}') {
			depth--;
			if (depth === 0) return { content: s.slice(start + 1, i), end: i };
		}
	}
	return null;
}

function skipSpaces(s: string, pos: number): number {
	while (pos < s.length && s[pos] === ' ') pos++;
	return pos;
}

function replaceFracs(s: string): string {
	s = s.replace(/\\[dt]frac/g, '\\frac');
	let changed = true;
	while (changed) {
		changed = false;
		const idx = s.indexOf('\\frac');
		if (idx === -1) break;
		let pos = skipSpaces(s, idx + 5);
		const num = extractBraceGroup(s, pos);
		if (!num) break;
		pos = skipSpaces(s, num.end + 1);
		const den = extractBraceGroup(s, pos);
		if (!den) break;
		s = s.slice(0, idx) + `(${num.content})/(${den.content})` + s.slice(den.end + 1);
		changed = true;
	}
	return s;
}

function replaceSqrts(s: string): string {
	let changed = true;
	while (changed) {
		changed = false;
		const idx = s.indexOf('\\sqrt');
		if (idx === -1) break;
		let pos = skipSpaces(s, idx + 5);
		let nthRoot: string | null = null;
		if (s[pos] === '[') {
			const closeIdx = s.indexOf(']', pos);
			if (closeIdx !== -1) {
				nthRoot = s.slice(pos + 1, closeIdx).trim();
				pos = skipSpaces(s, closeIdx + 1);
			}
		}
		const arg = extractBraceGroup(s, pos);
		if (!arg) break;
		const repl = nthRoot ? `(${arg.content})^(1/${nthRoot})` : `sqrt(${arg.content})`;
		s = s.slice(0, idx) + repl + s.slice(arg.end + 1);
		changed = true;
	}
	return s;
}

function replaceBraceExponents(s: string): string {
	let changed = true;
	while (changed) {
		changed = false;
		const idx = s.indexOf('^{');
		if (idx === -1) break;
		const group = extractBraceGroup(s, idx + 1);
		if (!group) break;
		s = s.slice(0, idx) + `^(${group.content})` + s.slice(group.end + 1);
		changed = true;
	}
	return s;
}

function removeSubscripts(s: string): string {
	let changed = true;
	while (changed) {
		changed = false;
		const idx = s.indexOf('_{');
		if (idx === -1) break;
		const group = extractBraceGroup(s, idx + 1);
		if (!group) break;
		s = s.slice(0, idx) + s.slice(group.end + 1);
		changed = true;
	}
	s = s.replace(/_[a-zA-Z0-9]/g, '');
	return s;
}

import type { PiecewiseBoundary } from './types';

export interface ParsedPiecewise {
	mathExpr: string;
	boundaries: Array<Omit<PiecewiseBoundary, 'y'>>;
}

function latexCondToMathjs(cond: string): string {
	let s = cond.trim();
	s = s.replace(/\\geq(?![a-zA-Z])/g, '>=');
	s = s.replace(/\\ge(?![a-zA-Z])/g, '>=');
	s = s.replace(/\\leq(?![a-zA-Z])/g, '<=');
	s = s.replace(/\\le(?![a-zA-Z])/g, '<=');
	s = s.replace(/\\gt(?![a-zA-Z])/g, '>');
	s = s.replace(/\\lt(?![a-zA-Z])/g, '<');
	s = s.replace(/\\neq(?![a-zA-Z])/g, '!=');
	return latexToMathjs(s);
}

function parseSingleBound(cond: string): { x: number; open: boolean } | null {
	const s = cond.trim();
	// x <= c or x < c
	let m = s.match(/^x\s*(<=|<)\s*(-?\d+(?:\.\d+)?)$/);
	if (m) return { x: parseFloat(m[2]), open: m[1] === '<' };
	// x >= c or x > c
	m = s.match(/^x\s*(>=|>)\s*(-?\d+(?:\.\d+)?)$/);
	if (m) return { x: parseFloat(m[2]), open: m[1] === '>' };
	// c <= x or c < x  (→ x >= c or x > c)
	m = s.match(/^(-?\d+(?:\.\d+)?)\s*(<=|<)\s*x$/);
	if (m) return { x: parseFloat(m[1]), open: m[2] === '<' };
	// c >= x or c > x  (→ x <= c or x < c)
	m = s.match(/^(-?\d+(?:\.\d+)?)\s*(>=|>)\s*x$/);
	if (m) return { x: parseFloat(m[1]), open: m[2] === '>' };
	return null;
}

export function parsePiecewiseLatex(input: string): ParsedPiecewise | null {
	const casesMatch = input.match(/\\begin\s*\{cases\}([\s\S]*?)\\end\s*\{cases\}/);
	if (!casesMatch) return null;

	const inner = casesMatch[1];
	const rows = inner
		.split('\\\\')
		.map((r) => r.trim())
		.filter((r) => r.length > 0);
	if (rows.length < 2) return null;

	const pieces: { mathExpr: string; mathCond: string }[] = [];
	for (const row of rows) {
		const ampIdx = row.indexOf('&');
		if (ampIdx === -1) continue;
		const mathExpr = latexToMathjs(row.slice(0, ampIdx).trim());
		const mathCond = latexCondToMathjs(row.slice(ampIdx + 1).trim());
		pieces.push({ mathExpr, mathCond });
	}
	if (pieces.length < 2) return null;

	// Last piece is the default else branch — no condition needed
	let mathExpr = pieces[pieces.length - 1].mathExpr;
	for (let i = pieces.length - 2; i >= 0; i--) {
		mathExpr = `((${pieces[i].mathCond}) ? (${pieces[i].mathExpr}) : (${mathExpr}))`;
	}

	const boundaries: Array<Omit<PiecewiseBoundary, 'y'>> = [];
	for (const piece of pieces) {
		const bound = parseSingleBound(piece.mathCond);
		if (bound) {
			boundaries.push({ x: bound.x, open: bound.open, pieceExpr: piece.mathExpr });
		}
	}

	return { mathExpr, boundaries };
}

// Parses domain-restriction syntax: "expression : condition"
// e.g. "x+3 : x < 1"  →  ternary + boundary metadata
export function parseDomainRestriction(rhs: string): ParsedPiecewise | null {
	const sepIdx = rhs.indexOf(' : ');
	if (sepIdx === -1) return null;
	const mathExpr = latexToMathjs(rhs.slice(0, sepIdx).trim());
	const mathCond = latexCondToMathjs(rhs.slice(sepIdx + 3).trim());
	const boundaries: Array<Omit<PiecewiseBoundary, 'y'>> = [];
	const bound = parseSingleBound(mathCond);
	if (bound) boundaries.push({ x: bound.x, open: bound.open, pieceExpr: mathExpr });
	return { mathExpr: `((${mathCond}) ? (${mathExpr}) : (NaN))`, boundaries };
}

export function latexToMathjs(input: string): string {
	if (!input.includes('\\') && !input.includes('{')) return input;

	let s = input;

	// Whitespace/formatting commands
	s = s.replace(/\\[,;!]|\\quad|\\qquad/g, ' ');
	s = s.replace(/\\text\s*\{[^{}]*\}/g, '');

	// Operators and constants
	s = s.replace(/\\cdot/g, '*');
	s = s.replace(/\\times/g, '*');
	s = s.replace(/\\div/g, '/');
	s = s.replace(/\\pi/g, 'pi');

	// Absolute value: \left|...\right| → abs(...), innermost first
	let prev = '';
	while (prev !== s) {
		prev = s;
		s = s.replace(/\\left\s*\|([^|]*?)\\right\s*\|/g, 'abs($1)');
	}

	// \left/\right brackets and parens → plain parens
	s = s.replace(/\\left\s*[([]/g, '(');
	s = s.replace(/\\right\s*[)\]]/g, ')');
	s = s.replace(/\\left\s*\./g, '');
	s = s.replace(/\\right\s*\./g, '');

	// Trig, log, and other math functions (strip backslash)
	s = s.replace(
		/\\(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|csc|sec|cot|exp|ln|log)/g,
		'$1',
	);

	s = replaceFracs(s);
	s = replaceSqrts(s);
	s = replaceBraceExponents(s);
	s = removeSubscripts(s);

	// Remaining bare braces used for grouping → parens
	s = s.replace(/\{/g, '(').replace(/\}/g, ')');

	s = s.replace(/\s+/g, ' ').trim();
	return s;
}
