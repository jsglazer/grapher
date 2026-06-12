import { describe, it, expect } from 'vitest';
import { latexToMathjs } from '../src/latexToMathjs';

describe('latexToMathjs', () => {
	it('passes plain expressions through unchanged', () => {
		expect(latexToMathjs('x^2 + 1')).toBe('x^2 + 1');
	});

	it('converts \\frac to parenthesised division', () => {
		expect(latexToMathjs('\\frac{1}{2}')).toBe('(1)/(2)');
	});

	it('converts \\sqrt to sqrt()', () => {
		expect(latexToMathjs('\\sqrt{x}')).toBe('sqrt(x)');
	});

	it('maps \\pi to pi', () => {
		expect(latexToMathjs('\\pi')).toBe('pi');
	});
});
