export interface PiecewiseBoundary {
	x: number;
	open: boolean; // true = open circle (strict inequality, point not included)
	pieceExpr: string; // math.js expression for this piece; used to compute y at boundary
	y?: number; // resolved in main.ts after params are known
}

export interface EquationConfig {
	rawEquation: string;
	equation: string;
	label?: string;
	lineColor: string;
	lineWidth: number;
	lineStyle?: string;
	showIntX: boolean;
	showIntY: boolean;
	points?: Array<{ x: number; y: number }>;
	pointColor?: string;
	piecewiseBoundaries?: PiecewiseBoundary[];
}

export interface GraphConfig {
	equations: EquationConfig[];
	params?: Record<string, number>;
	title?: string;
	axisColor: string;
	renderWidth: string;
	xMin?: number;
	xMax?: number;
	yMin?: number;
	yMax?: number;
	eqLoc?: 'left' | 'right' | 'above' | 'below';
	globalPoints?: Array<{ x: number; y: number }>;
}
