# Grapher

[![GitHub release](https://img.shields.io/github/v/release/jsglazer/grapher?logo=github)](https://github.com/jsglazer/grapher/releases)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/jsglazer/grapher/blob/main/LICENSE)
[![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97756?logo=anthropic)](https://claude.ai)
[![Gemini Flash Antigravity](https://img.shields.io/badge/Gemini%20Flash-Antigravity-4f86f7?logo=google-gemini&logoColor=white)](https://github.com/google-gemini)

An Obsidian plugin that renders mathematical equations as graphs directly in your notes using a `grapher` code block.

**Repository:** https://github.com/jsglazer/grapher-dev

---

![Example](quadcub.png)


## Usage

Create a fenced code block with the language set to `grapher`:

````
```grapher
eq: f(x) = x^3 - 3x^2 - 4x
axis: #c2c2c2
linecolor: #1e56d9
linewidth: 2px
width: 60%
```
````

---

## Parameters

### Global options

| Parameter | Description | Example |
|-----------|-------------|---------|
| `title:` | Graph title displayed at the top in a white box | `title: My Graph` |
| `axis:` | Color of axes, tick marks, and grid | `axis: #c2c2c2` |
| `width:` | Width of the rendered graph (px or %) | `width: 50%` or `width: 400px` |
| `scalex:` | X-axis range. Two values = `min,max`. Single value = symmetric `±n`. Omit for auto. | `scalex: -10,10` or `scalex: 5` |
| `scaley:` | Y-axis range. Same format as `scalex`. | `scaley: -2,2` or `scaley: 3` |
| `EqLoc:` | Position of equation label on the graph. Options: `left`, `right`, `above`, `below`. Omit to hide. | `EqLoc: left` |
| `params:` | Named constants available to all equations, comma-separated `name=value` pairs. | `params: n=3, a=2` |

### Constants (params)

Use `params:` to define named constant values that can be referenced in any equation. This is useful for equations with variable exponents, scaling factors, or any expression that depends on a value you want to change without rewriting the equation.

```
eq: f(x) = x^{1/n}
params: n=3
```

Multiple constants are comma-separated:

```
eq: f(x) = a * x^{1/n}
params: n=3, a=2
```

Params apply to **all** equations in the block, so you can share a constant across curves:

````
```grapher
eq1: f(x) = x^{1/n}
eq2: g(x) = x^{2/n}
params: n=3
axis: #c2c2c2
EqLoc: right
```
````

When `EqLoc:` is set, param values are shown in the equation label below the curve list.

> **Note:** Only `x` is the free variable. Every other letter in an equation must be given a value via `params:`, otherwise the curve will not render.

---

### Per-equation options

**Single equation** — use `eq:` with options at the global level:

```
eq: f(x) = x^2
linecolor: #1e56d9
linewidth: 2px
intx: true
```

**Multiple equations** — use `eq1:`, `eq2:`, etc. with per-equation sub-options prefixed by ` - `. `eq:` is not valid when graphing multiple equations.

```
eq1: f(x) = x^2
 - linecolor: #1e56d9
 - linewidth: 2px
 - intx: true
eq2: g(x) = x + 1
 - linecolor: #d91e1e
 - linewidth: 1px
```

| Parameter | Description | Example |
|-----------|-------------|---------|
| `eq:` | Equation key for a **single** equation only. | `eq: f(x) = sin(x)` |
| `eq1:` / `eq2:` / `eq3:` ... | Equation keys for **multiple** equations. | `eq1: f(x) = x^2` |
| `linecolor:` | Curve color (hex) | `linecolor: #1e56d9` |
| `linewidth:` | Stroke width in px | `linewidth: 2px` |
| `linestyle:` | Stroke style. Options: `solid` (default), `dash`, `double`, `dash-double` | `linestyle: dash` |
| `intx:` | Plot x-intercepts with coordinate labels | `intx: true` |
| `inty:` | Plot y-intercept with coordinate label | `inty: true` |
| `points:` | One or more user-defined points to display, as `{x,y}` pairs | `points: {1,2}, {-3,0.5}` |
| `pointcolor:` | Color for user-defined points and their labels (defaults to curve color) | `pointcolor: #e08000` |

---

### Inline equation labels (`//`)

Append `// label text` to any equation line to add a plain-text label that appears alongside the typeset equation in the overlay box. The label is displayed to the right of the equation in italics.

```
eq1: f(x) = e^x  //natural exponential
eq2: g(x) = ln(x)  //natural log
```

If any equation has a `//` label, the overlay box is shown automatically in the `right` position (unless `EqLoc:` overrides the position).

---

### Standalone points (global)

Use a top-level `points:` key to plot points that are not tied to any equation. These render with a **black** dot and black coordinate label.

```
eq: f(x) = x^2
points: {-2,4}, {0,0}, {2,4}
```

Global `points:` and per-equation `- points:` can coexist in the same block.

---

## Settings — Graph Template

Open **Settings → Grapher** to configure a default graph template. Enter any valid grapher block content in the text area (10 lines).

Run the command **Grapher: Insert default graph** to insert the template as a fenced `grapher` block at the cursor position.

---

## Supported expressions

Grapher uses [math.js](https://mathjs.org) for evaluation. Supported syntax includes:

- Polynomials: `x^3 - 3x^2 + 2x - 1`
- Trig functions: `sin(x)`, `cos(x)`, `tan(x)`, `asin(x)`, `acos(x)`, `atan(x)`
- Exponentials and logs: `e^x`, `exp(x)`, `log(x)`, `log(x, 10)`
- Square roots and powers: `sqrt(x)`, `x^(1/3)`
- Constants: `pi`, `e`
- Implicit multiplication: `3x`, `2sin(x)`

### LaTeX input

LaTeX notation is also accepted and converted automatically. Common patterns:

| LaTeX | math.js equivalent |
|-------|--------------------|
| `\frac{a}{b}` | `(a)/(b)` |
| `\sqrt{x}` | `sqrt(x)` |
| `\sqrt[n]{x}` | `x^(1/n)` |
| `x^{n+1}` | `x^(n+1)` |
| `\sin`, `\cos`, `\ln`, etc. | `sin`, `cos`, `ln`, etc. |
| `\pi` | `pi` |
| `\left(\ldots\right)` | `(...)` |
| `\left\|x\right\|` | `abs(x)` |
| `\cdot`, `\times` | `*` |

Example: `eq: f(x) = 2 + \frac{1}{x}` is valid.

### Piecewise-defined functions

Define each piece as its own equation with a domain restriction after ` : ` (space-colon-space):

````
```grapher
eq1: x+3 : x < 1
eq2: (x-2)^2 : x \ge 1
```
````

Open circles ○ are drawn at strict-inequality boundaries (`<`, `>`); closed circles ● at inclusive boundaries (`\le`, `\ge`, `\leq`, `\geq`).

Pieces are independent equations, so each can have its own `linecolor:` and `linewidth:`:

````
```grapher
eq1: x+3 : x < 1
 - linecolor: #1e56d9
eq2: (x-2)^2 : x \ge 1
 - linecolor: #1e56d9
scalex: -3,5
scaley: -1,6
```
````

Any expression valid in a regular `eq:` field works as a piece, including LaTeX (`\frac`, `\sqrt`, trig), and `params:` constants.

**Alternative — LaTeX cases notation**

You can also use `\begin{cases}...\end{cases}` to express the whole piecewise function as a single equation (useful when you want one label entry):

````
```grapher
eq: f(x) = \begin{cases} x+3 & x < 1 \\ (x-2)^2 & x \ge 1 \end{cases}
```
````

---

## Sample — multiple equations

````
```grapher
title: Quadratic vs Cubic
eq1: f(x) = -2x^2 + 4x - 1
 - linecolor: #1e56d9
 - linewidth: 2px
 - intx: true
 - inty: true
eq2: g(x) = x^3 - 3x^2 - 4x
 - linecolor: #d91e1e
 - linewidth: 1px
 - intx: true
axis: #c2c2c2
width: 75%
EqLoc: above
scalex: -5,6
scaley: 5
```
````
