import { EquationConfig, GraphConfig } from './types';
import { latexToMathjs, parsePiecewiseLatex, parseDomainRestriction } from './latexToMathjs';

const EQ_DEFAULTS = { lineColor: '#1e56d9', lineWidth: 2 };
const GLOBAL_DEFAULTS = { axisColor: '#888888', renderWidth: '100%' };

function isEqKey(key: string): boolean {
	return /^eq\d*$/.test(key);
}

function parseEquationRHS(raw: string): string {
	const fnPrefix = raw.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*=\s*/);
	if (fnPrefix) return raw.slice(fnPrefix[0].length).trim();
	// Domain-restriction syntax (expr : cond) — = inside condition must not be the separator
	if (raw.includes(' : ')) return raw;
	// \begin{cases} — = inside conditions must not be the separator
	const casesStart = raw.search(/\\begin\s*\{cases\}/);
	const eqIdx = raw.indexOf('=');
	if (casesStart !== -1 && (eqIdx === -1 || casesStart < eqIdx)) return raw;
	if (eqIdx !== -1) return raw.slice(eqIdx + 1).trim();
	return raw;
}

// "min,max" → two values; single "n" → symmetric [-n, n]; blank side → undefined (auto).
function parseScale(raw: string): [number | undefined, number | undefined] {
	if (raw.includes(',')) {
		const [lo, hi] = raw.split(',');
		const min = lo.trim() ? parseFloat(lo.trim()) : undefined;
		const max = hi?.trim() ? parseFloat(hi.trim()) : undefined;
		return [
			min !== undefined && !isNaN(min) ? min : undefined,
			max !== undefined && !isNaN(max) ? max : undefined,
		];
	}
	const n = parseFloat(raw.trim());
	if (isNaN(n)) return [undefined, undefined];
	return [-Math.abs(n), Math.abs(n)];
}

function parsePointsList(raw: string): Array<{ x: number; y: number }> {
	const pts: Array<{ x: number; y: number }> = [];
	const re = /\{([^}]+)\}/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(raw)) !== null) {
		const parts = m[1].split(',');
		if (parts.length === 2) {
			const px = parseFloat(parts[0].trim());
			const py = parseFloat(parts[1].trim());
			if (!isNaN(px) && !isNaN(py)) pts.push({ x: px, y: py });
		}
	}
	return pts;
}

export function parseGrapherBlock(source: string): GraphConfig {
	type EqBlock = { key: string; rawValue: string; sub: Record<string, string> };
	const eqBlocks: EqBlock[] = [];
	const globalRaw: Record<string, string> = {};
	let current: EqBlock | null = null;

	for (const line of source.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const isSub = trimmed.startsWith('- ');
		const content = isSub ? trimmed.slice(2).trim() : trimmed;
		const colonIdx = content.indexOf(':');
		if (colonIdx === -1) continue;

		const key = content.slice(0, colonIdx).trim().toLowerCase();
		const value = content.slice(colonIdx + 1).trim();
		if (!key || !value) continue;

		if (isSub) {
			if (current) current.sub[key] = value;
		} else if (isEqKey(key)) {
			current = { key, rawValue: value, sub: {} };
			eqBlocks.push(current);
		} else {
			globalRaw[key] = value;
		}
	}

	if (eqBlocks.length === 0) {
		throw new Error('Missing required parameter: eq');
	}

	// eq: is only valid for a single equation; multiple equations must use eq1:, eq2:, etc.
	if (eqBlocks.length > 1 && eqBlocks.some((b) => b.key === 'eq')) {
		throw new Error(
			'Use eq1:, eq2:, ... for multiple equations. eq: is for a single equation only.',
		);
	}

	const fallback = {
		linecolor: globalRaw['linecolor'],
		linewidth: globalRaw['linewidth'],
		linestyle: globalRaw['linestyle'],
		intx: globalRaw['intx'],
		inty: globalRaw['inty'],
	};

	const equations: EquationConfig[] = eqBlocks.map((block) => {
		const lw = parseFloat((block.sub['linewidth'] ?? fallback.linewidth ?? '').replace(/px$/i, ''));

		// Strip // label from raw value
		let rawValue = block.rawValue;
		let label: string | undefined;
		const labelIdx = rawValue.indexOf('//');
		if (labelIdx !== -1) {
			label = rawValue.slice(labelIdx + 2).trim() || undefined;
			rawValue = rawValue.slice(0, labelIdx).trim();
		}

		const rhs = parseEquationRHS(rawValue);
		const parsed = parseDomainRestriction(rhs) ?? parsePiecewiseLatex(rhs);

		const points = parsePointsList(block.sub['points'] ?? '');

		const eq: EquationConfig = {
			rawEquation: rawValue,
			equation: parsed ? parsed.mathExpr : latexToMathjs(rhs),
			...(label !== undefined && { label }),
			lineColor: block.sub['linecolor'] ?? fallback.linecolor ?? EQ_DEFAULTS.lineColor,
			lineWidth: isNaN(lw) ? EQ_DEFAULTS.lineWidth : lw,
			lineStyle: block.sub['linestyle'] ?? fallback.linestyle,
			showIntX: (block.sub['intx'] ?? fallback.intx ?? 'false').toLowerCase() === 'true',
			showIntY: (block.sub['inty'] ?? fallback.inty ?? 'false').toLowerCase() === 'true',
			...(points.length > 0 && { points }),
			...(block.sub['pointcolor'] && { pointColor: block.sub['pointcolor'] }),
		};
		if (parsed && parsed.boundaries.length > 0) {
			eq.piecewiseBoundaries = parsed.boundaries;
		}
		return eq;
	});

	const paramsRaw = globalRaw['params'];
	const params: Record<string, number> = {};
	if (paramsRaw) {
		for (const pair of paramsRaw.split(',')) {
			const eqIdx2 = pair.indexOf('=');
			if (eqIdx2 === -1) continue;
			const name = pair.slice(0, eqIdx2).trim();
			const num = parseFloat(pair.slice(eqIdx2 + 1).trim());
			if (name && !isNaN(num)) params[name] = num;
		}
	}

	const eqLocRaw = globalRaw['eqloc']?.toLowerCase();
	const eqLoc = ['left', 'right', 'above', 'below'].includes(eqLocRaw ?? '')
		? (eqLocRaw as 'left' | 'right' | 'above' | 'below')
		: undefined;

	const config: GraphConfig = {
		equations,
		...(Object.keys(params).length > 0 && { params }),
		title: globalRaw['title'],
		axisColor: globalRaw['axis'] || GLOBAL_DEFAULTS.axisColor,
		renderWidth: globalRaw['width'] || GLOBAL_DEFAULTS.renderWidth,
		eqLoc,
	};

	if (globalRaw['xmin']) config.xMin = parseFloat(globalRaw['xmin']);
	if (globalRaw['xmax']) config.xMax = parseFloat(globalRaw['xmax']);
	if (globalRaw['ymin']) config.yMin = parseFloat(globalRaw['ymin']);
	if (globalRaw['ymax']) config.yMax = parseFloat(globalRaw['ymax']);

	if (globalRaw['scalex']) {
		const [lo, hi] = parseScale(globalRaw['scalex']);
		if (lo !== undefined) config.xMin = lo;
		if (hi !== undefined) config.xMax = hi;
	}
	if (globalRaw['scaley']) {
		const [lo, hi] = parseScale(globalRaw['scaley']);
		if (lo !== undefined) config.yMin = lo;
		if (hi !== undefined) config.yMax = hi;
	}

	if (globalRaw['points']) {
		const gpts = parsePointsList(globalRaw['points']);
		if (gpts.length > 0) config.globalPoints = gpts;
	}

	return config;
}
