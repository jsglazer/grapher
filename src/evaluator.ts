import { create, all, EvalFunction } from 'mathjs';

const math = create(all);

// Find the best rational approximation p/q for y with |q| <= maxDen.
// Returns null if none is found within tolerance.
function rationalApprox(y: number, maxDen = 100): [number, number] | null {
	const sign = y < 0 ? -1 : 1;
	const x = Math.abs(y);
	if (x < 1e-10) return [0, 1];

	let h0 = 1,
		k0 = 0,
		h1 = Math.floor(x),
		k1 = 1;
	let rem = x - Math.floor(x);
	if (rem < 1e-10) return [sign * Math.round(x), 1];

	for (let iter = 0; iter < 30; iter++) {
		rem = 1 / rem;
		const a = Math.floor(rem);
		const h2 = a * h1 + h0;
		const k2 = a * k1 + k0;
		if (k2 > maxDen) break;
		h0 = h1;
		k0 = k1;
		h1 = h2;
		k1 = k2;
		rem -= a;
		if (Math.abs(x - h1 / k1) < 1e-10) break;
		if (rem < 1e-10) break;
	}

	return Math.abs(y - (sign * h1) / k1) < 1e-9 ? [sign * h1, k1] : null;
}

// Override pow so that x^(p/q) with x < 0 and q odd returns the real-valued
// result instead of a Complex number.  For example (-8)^(1/3) = -2.
math.import(
	{
		pow: function (base: unknown, exp: unknown): unknown {
			if (typeof base !== 'number' || typeof exp !== 'number')
				return Math.pow(base as number, exp as number);
			if (!isFinite(base) || !isFinite(exp)) return NaN;
			if (base >= 0) return Math.pow(base, exp);

			// base < 0: return real result only when the denominator of the
			// reduced fraction p/q is odd.
			const rational = rationalApprox(exp);
			if (rational) {
				const [p, q] = rational;
				if (q % 2 === 1) {
					// (-|x|)^(p/q) = (-1)^|p| * |x|^(p/q)
					const absResult = Math.pow(Math.abs(base), exp);
					return Math.abs(p) % 2 === 0 ? absResult : -absResult;
				}
			}
			return NaN;
		},
	},
	{ override: true },
);

export class Evaluator {
	private compiled: EvalFunction;
	private params: Record<string, number>;

	constructor(equation: string, params: Record<string, number> = {}) {
		this.compiled = math.compile(equation);
		this.params = params;
	}

	evaluate(x: number): number {
		try {
			const result: unknown = this.compiled.evaluate({ x, ...this.params });
			if (typeof result !== 'number') return NaN;
			return result;
		} catch {
			return NaN;
		}
	}

	// Returns y values for evenly spaced x in [xMin, xMax]
	sample(xMin: number, xMax: number, steps: number): number[] {
		const results: number[] = [];
		const step = (xMax - xMin) / steps;
		for (let i = 0; i <= steps; i++) {
			results.push(this.evaluate(xMin + i * step));
		}
		return results;
	}

	// Finds x-intercepts (roots) in [xMin, xMax] using sign-change + bisection.
	findXIntercepts(xMin: number, xMax: number, steps = 1000): number[] {
		const roots: number[] = [];
		const step = (xMax - xMin) / steps;

		for (let i = 0; i < steps; i++) {
			const xa = xMin + i * step;
			const xb = xa + step;
			const ya = this.evaluate(xa);
			const yb = this.evaluate(xb);

			if (!isFinite(ya) || !isFinite(yb)) continue;

			if (Math.abs(ya) < 1e-10) {
				if (!roots.some((r) => Math.abs(r - xa) < 1e-6)) roots.push(xa);
				continue;
			}
			if (Math.sign(ya) === Math.sign(yb)) continue;

			// Bisection refinement
			let lo = xa,
				hi = xb,
				ylo = ya;
			for (let j = 0; j < 50; j++) {
				const mid = (lo + hi) / 2;
				const ymid = this.evaluate(mid);
				if (!isFinite(ymid)) break;
				if (Math.abs(ymid) < 1e-12) {
					lo = hi = mid;
					break;
				}
				if (Math.sign(ymid) === Math.sign(ylo)) {
					lo = mid;
					ylo = ymid;
				} else hi = mid;
			}

			const root = (lo + hi) / 2;
			if (!roots.some((r) => Math.abs(r - root) < 1e-6)) {
				roots.push(root);
			}
		}

		return roots;
	}

	// Returns f(0), or null if x=0 is undefined.
	findYIntercept(): number | null {
		const y = this.evaluate(0);
		return isFinite(y) ? y : null;
	}
}
