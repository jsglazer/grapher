import { GraphConfig } from './types';
import { Evaluator } from './evaluator';

const STEPS = 800;
const BASE_PAD = { top: 20, right: 20, bottom: 42, left: 58 };
const TITLE_PAD_TOP = 38;
const DOT_RADIUS = 4;

function getLineDash(style: string | undefined): number[] {
	switch (style) {
		case 'dash':
			return [8, 4];
		case 'dash-double':
			return [10, 4, 4, 4];
		default:
			return [];
	}
}

function niceTickSpacing(range: number, targetTicks = 8): number {
	const rough = range / targetTicks;
	const exp = Math.floor(Math.log10(rough));
	const f = rough / Math.pow(10, exp);
	let nice: number;
	if (f < 1.5) nice = 1;
	else if (f < 3.5) nice = 2;
	else if (f < 7.5) nice = 5;
	else nice = 10;
	return nice * Math.pow(10, exp);
}

function formatLabel(value: number): string {
	if (Math.abs(value) < 1e-10) return '0';
	if (Math.abs(value) >= 10000 || Math.abs(value) < 0.01) return value.toExponential(1);
	return parseFloat(value.toPrecision(4)).toString();
}

function formatCoord(n: number): string {
	if (Math.abs(n) < 1e-10) return '0';
	return parseFloat(n.toPrecision(4)).toString();
}

function drawDot(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
	ctx.save();
	ctx.fillStyle = color;
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

function drawOpenCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
	ctx.save();
	ctx.fillStyle = '#ffffff';
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}

function drawCoordLabel(
	ctx: CanvasRenderingContext2D,
	text: string,
	dotX: number,
	dotY: number,
	color = '#000000',
) {
	ctx.save();
	ctx.font = 'bold 10px monospace';
	const tw = ctx.measureText(text).width;
	const th = 11;
	const px = 3,
		py = 2;
	const lx = dotX + DOT_RADIUS + 3;
	const ly = dotY - th - DOT_RADIUS - 1;
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(lx - px, ly - py, tw + px * 2, th + py * 2);
	ctx.fillStyle = color;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillText(text, lx, ly);
	ctx.restore();
}

function drawTitle(ctx: CanvasRenderingContext2D, title: string, plotX: number, plotW: number) {
	ctx.save();
	ctx.font = 'bold 13px sans-serif';
	const tw = ctx.measureText(title).width;
	const boxW = tw + 16;
	const boxH = 22;
	const bx = plotX + (plotW - boxW) / 2;
	const by = 5;
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(bx, by, boxW, boxH);
	ctx.strokeStyle = '#cccccc';
	ctx.lineWidth = 0.5;
	ctx.strokeRect(bx, by, boxW, boxH);
	ctx.fillStyle = '#000000';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(title, bx + boxW / 2, by + boxH / 2);
	ctx.restore();
}

export function renderGraph(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	config: GraphConfig,
	evaluators: Evaluator[],
): void {
	ctx.clearRect(0, 0, width, height);

	const PAD = { ...BASE_PAD, top: config.title ? TITLE_PAD_TOP : BASE_PAD.top };

	const xMin = config.xMin ?? -10;
	const xMax = config.xMax ?? 10;

	// Sample all equations to determine combined y range
	const allSamples = evaluators.map((ev) => ev.sample(xMin, xMax, STEPS));
	const allFinite = allSamples.flat().filter((v) => isFinite(v));

	let yMin: number, yMax: number;
	if (config.yMin !== undefined && config.yMax !== undefined) {
		yMin = config.yMin;
		yMax = config.yMax;
	} else {
		if (allFinite.length === 0) {
			yMin = -10;
			yMax = 10;
		} else {
			let lo = allFinite[0],
				hi = allFinite[0];
			for (const v of allFinite) {
				if (v < lo) lo = v;
				if (v > hi) hi = v;
			}
			const pad = (hi - lo) * 0.12 || 1;
			yMin = config.yMin ?? lo - pad;
			yMax = config.yMax ?? hi + pad;
		}
	}

	const plotW = width - PAD.left - PAD.right;
	const plotH = height - PAD.top - PAD.bottom;

	const toX = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin)) * plotW;
	const toY = (y: number) => PAD.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

	const axisY = Math.max(PAD.top, Math.min(PAD.top + plotH, toY(0)));
	const axisX = Math.max(PAD.left, Math.min(PAD.left + plotW, toX(0)));

	const xSpacing = niceTickSpacing(xMax - xMin);
	const ySpacing = niceTickSpacing(yMax - yMin);
	const xTickStart = Math.ceil(xMin / xSpacing) * xSpacing;
	const yTickStart = Math.ceil(yMin / ySpacing) * ySpacing;

	// --- Grid ---
	ctx.save();
	ctx.strokeStyle = config.axisColor + '28';
	ctx.lineWidth = 0.5;
	for (let x = xTickStart; x <= xMax + 1e-10; x += xSpacing) {
		const cx = toX(x);
		ctx.beginPath();
		ctx.moveTo(cx, PAD.top);
		ctx.lineTo(cx, PAD.top + plotH);
		ctx.stroke();
	}
	for (let y = yTickStart; y <= yMax + 1e-10; y += ySpacing) {
		const cy = toY(y);
		ctx.beginPath();
		ctx.moveTo(PAD.left, cy);
		ctx.lineTo(PAD.left + plotW, cy);
		ctx.stroke();
	}
	ctx.restore();

	// --- Axes ---
	ctx.save();
	ctx.strokeStyle = config.axisColor;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(PAD.left, axisY);
	ctx.lineTo(PAD.left + plotW, axisY);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(axisX, PAD.top);
	ctx.lineTo(axisX, PAD.top + plotH);
	ctx.stroke();
	ctx.restore();

	// --- Tick marks and labels ---
	ctx.save();
	ctx.strokeStyle = config.axisColor;
	ctx.fillStyle = config.axisColor;
	ctx.lineWidth = 1;
	ctx.font = '11px monospace';

	const xLabelBelow = axisY <= PAD.top + plotH - 20;
	ctx.textAlign = 'center';
	ctx.textBaseline = xLabelBelow ? 'top' : 'bottom';
	for (let x = xTickStart; x <= xMax + 1e-10; x += xSpacing) {
		if (Math.abs(x) < xSpacing * 0.01) continue;
		const cx = toX(x);
		ctx.beginPath();
		ctx.moveTo(cx, axisY - 4);
		ctx.lineTo(cx, axisY + 4);
		ctx.stroke();
		ctx.fillText(formatLabel(x), cx, xLabelBelow ? axisY + 6 : axisY - 6);
	}

	const yLabelLeft = axisX >= PAD.left + 20;
	ctx.textAlign = yLabelLeft ? 'right' : 'left';
	ctx.textBaseline = 'middle';
	for (let y = yTickStart; y <= yMax + 1e-10; y += ySpacing) {
		if (Math.abs(y) < ySpacing * 0.01) continue;
		const cy = toY(y);
		ctx.beginPath();
		ctx.moveTo(axisX - 4, cy);
		ctx.lineTo(axisX + 4, cy);
		ctx.stroke();
		ctx.fillText(formatLabel(y), yLabelLeft ? axisX - 8 : axisX + 8, cy);
	}

	if (yMin < 0 && yMax > 0 && xMin < 0 && xMax > 0) {
		ctx.textAlign = 'right';
		ctx.textBaseline = 'top';
		ctx.fillText('0', axisX - 6, axisY + 4);
	}
	ctx.restore();

	// --- Curves + intercept dots (clipped) ---
	ctx.save();
	ctx.beginPath();
	ctx.rect(PAD.left, PAD.top, plotW, plotH);
	ctx.clip();

	const yRange = yMax - yMin;
	const JUMP_THRESHOLD = 0.4 * yRange;
	const xStep = (xMax - xMin) / STEPS;

	for (let ei = 0; ei < config.equations.length; ei++) {
		const eq = config.equations[ei];
		const ev = evaluators[ei];
		const samples = allSamples[ei];

		// Curve
		ctx.strokeStyle = eq.lineColor;
		ctx.lineWidth = eq.lineWidth;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.setLineDash(getLineDash(eq.lineStyle));
		ctx.beginPath();
		let penDown = false;

		for (let i = 0; i <= STEPS; i++) {
			const y = samples[i];
			if (!isFinite(y)) {
				penDown = false;
				continue;
			}
			if (penDown && i > 0 && isFinite(samples[i - 1])) {
				if (Math.abs(y - samples[i - 1]) > JUMP_THRESHOLD) penDown = false;
			}
			const cx = toX(xMin + i * xStep);
			const cy = toY(y);
			if (!penDown) {
				ctx.moveTo(cx, cy);
				penDown = true;
			} else ctx.lineTo(cx, cy);
		}

		if (eq.lineStyle === 'double') {
			ctx.save();
			ctx.translate(-1.5, 0);
			ctx.stroke();
			ctx.restore();
			ctx.save();
			ctx.translate(1.5, 0);
			ctx.stroke();
			ctx.restore();
		} else {
			ctx.stroke();
		}
		ctx.setLineDash([]);

		// Piecewise boundary circles
		if (eq.piecewiseBoundaries) {
			for (const b of eq.piecewiseBoundaries) {
				if (b.y === undefined || !isFinite(b.y)) continue;
				if (b.x < xMin || b.x > xMax) continue;
				const cx = toX(b.x);
				const cy = toY(b.y);
				if (b.open) drawOpenCircle(ctx, cx, cy, eq.lineColor);
				else drawDot(ctx, cx, cy, eq.lineColor);
			}
		}

		// X-intercept dots + coord labels
		if (eq.showIntX) {
			for (const rootX of ev.findXIntercepts(xMin, xMax)) {
				const cx = toX(rootX);
				const cy = toY(0);
				drawDot(ctx, cx, cy, eq.lineColor);
				drawCoordLabel(ctx, `(${formatCoord(rootX)}, 0)`, cx, cy, eq.lineColor);
			}
		}

		// Y-intercept dot + coord label
		if (eq.showIntY && xMin <= 0 && xMax >= 0) {
			const yi = ev.findYIntercept();
			if (yi !== null) {
				const cx = toX(0);
				const cy = toY(yi);
				drawDot(ctx, cx, cy, eq.lineColor);
				drawCoordLabel(ctx, `(0, ${formatCoord(yi)})`, cx, cy, eq.lineColor);
			}
		}

		// User-defined points (per-equation)
		if (eq.points) {
			const ptColor = eq.pointColor ?? eq.lineColor;
			for (const pt of eq.points) {
				if (pt.x < xMin || pt.x > xMax || pt.y < yMin || pt.y > yMax) continue;
				const cx = toX(pt.x);
				const cy = toY(pt.y);
				drawDot(ctx, cx, cy, ptColor);
				drawCoordLabel(ctx, `(${formatCoord(pt.x)}, ${formatCoord(pt.y)})`, cx, cy, ptColor);
			}
		}
	}

	// Standalone global points — black dot, black text
	if (config.globalPoints) {
		for (const pt of config.globalPoints) {
			if (pt.x < xMin || pt.x > xMax || pt.y < yMin || pt.y > yMax) continue;
			const cx = toX(pt.x);
			const cy = toY(pt.y);
			drawDot(ctx, cx, cy, '#000000');
			drawCoordLabel(ctx, `(${formatCoord(pt.x)}, ${formatCoord(pt.y)})`, cx, cy, '#000000');
		}
	}

	ctx.restore();

	// --- Title (drawn on top, outside clip) ---
	if (config.title) {
		drawTitle(ctx, config.title, PAD.left, plotW);
	}
}
