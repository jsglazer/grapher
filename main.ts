import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting, renderMath, finishRenderMath } from 'obsidian';
import { parseGrapherBlock } from './src/parser';
import { Evaluator } from './src/evaluator';
import { renderGraph } from './src/renderer';

interface GrapherSettings {
	graphTemplate: string;
}

const DEFAULT_SETTINGS: GrapherSettings = {
	graphTemplate: '',
};

// Must match the fixed padding constants in renderer.ts
const PLOT_PAD = { top: 20, topTitle: 38, right: 20, bottom: 42, left: 58 };
const LABEL_MARGIN = 10;

// Convert math.js expression to LaTeX-compatible string for display.
// LaTeX input (contains \) is returned unchanged.
function toDisplayLatex(s: string): string {
	if (s.includes('\\')) return s;
	let r = s;
	r = r.replace(/\bpi\b/g, '\\pi');
	r = r.replace(/\b(sqrt|sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp|abs)\b/g, '\\$1');
	r = r.replace(/\\sqrt\(([^()]+)\)/g, '\\sqrt{$1}');
	r = r.replace(/\\abs\(([^()]+)\)/g, '\\left|$1\\right|');
	r = r.replace(/\^\(([^()]+)\)/g, '^{$1}');
	return r;
}

export default class GrapherPlugin extends Plugin {
	settings!: GrapherSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GrapherSettingTab(this.app, this));

		this.addCommand({
			id: 'insert-default-graph',
			name: 'Insert default graph',
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				const tmpl = this.settings.graphTemplate;
				editor.replaceRange('```grapher\n' + tmpl + '\n```\n', editor.getCursor());
			},
		});

		this.registerMarkdownCodeBlockProcessor('grapher', async (source, el) => {
			let config;
			try {
				config = parseGrapherBlock(source);
			} catch (e: unknown) {
				el.createEl('p', {
					cls: 'grapher-error',
					text: `Grapher: ${e instanceof Error ? e.message : String(e)}`,
				});
				return;
			}

			const evaluators: Evaluator[] = [];
			for (const eq of config.equations) {
				try {
					evaluators.push(new Evaluator(eq.equation, config.params ?? {}));
				} catch (e: unknown) {
					el.createEl('p', {
						cls: 'grapher-error',
						text: `Grapher: invalid equation "${eq.rawEquation}" — ${e instanceof Error ? e.message : String(e)}`,
					});
					return;
				}
				// Resolve piecewise boundary y-values using each piece's own expression
				if (eq.piecewiseBoundaries) {
					for (const b of eq.piecewiseBoundaries) {
						try {
							const pieceEv = new Evaluator(b.pieceExpr, config.params ?? {});
							b.y = pieceEv.evaluate(b.x);
						} catch {
							b.y = undefined;
						}
					}
				}
			}

			const container = el.createDiv({ cls: 'grapher-container' });
			container.style.width = config.renderWidth;
			container.style.position = 'relative';

			const canvas = container.createEl('canvas');
			canvas.style.width = '100%';
			canvas.style.display = 'block';

			const draw = (displayWidth: number) => {
				const displayHeight = Math.round(displayWidth * 0.65);
				const dpr = window.devicePixelRatio || 1;
				canvas.width = Math.round(displayWidth * dpr);
				canvas.height = Math.round(displayHeight * dpr);
				canvas.style.height = `${displayHeight}px`;
				const ctx = canvas.getContext('2d');
				if (!ctx) return;
				ctx.scale(dpr, dpr);
				renderGraph(ctx, displayWidth, displayHeight, config, evaluators);
			};

			// Equation label overlay — rendered once as HTML with math typesetting
			const hasInlineLabels = config.equations.some(eq => eq.label);
			const effectiveEqLoc = config.eqLoc ?? (hasInlineLabels ? 'right' : undefined);

			if (effectiveEqLoc) {
				const padTop = config.title ? PLOT_PAD.topTitle : PLOT_PAD.top;

				const overlay = container.createDiv();
				overlay.style.position = 'absolute';
				overlay.style.top = '0';
				overlay.style.left = '0';
				overlay.style.right = '0';
				overlay.style.bottom = '0';
				overlay.style.pointerEvents = 'none';
				overlay.style.display = 'flex';

				switch (effectiveEqLoc) {
					case 'above':
						overlay.style.justifyContent = 'center';
						overlay.style.alignItems = 'flex-start';
						overlay.style.paddingTop = `${padTop + LABEL_MARGIN}px`;
						overlay.style.paddingLeft = `${PLOT_PAD.left}px`;
						overlay.style.paddingRight = `${PLOT_PAD.right}px`;
						break;
					case 'below':
						overlay.style.justifyContent = 'center';
						overlay.style.alignItems = 'flex-end';
						overlay.style.paddingBottom = `${PLOT_PAD.bottom + LABEL_MARGIN}px`;
						overlay.style.paddingLeft = `${PLOT_PAD.left}px`;
						overlay.style.paddingRight = `${PLOT_PAD.right}px`;
						break;
					case 'left':
						overlay.style.justifyContent = 'flex-start';
						overlay.style.alignItems = 'flex-start';
						overlay.style.paddingTop = `${padTop + LABEL_MARGIN}px`;
						overlay.style.paddingLeft = `${PLOT_PAD.left + LABEL_MARGIN}px`;
						break;
					case 'right':
						overlay.style.justifyContent = 'flex-end';
						overlay.style.alignItems = 'flex-start';
						overlay.style.paddingTop = `${padTop + LABEL_MARGIN}px`;
						overlay.style.paddingRight = `${PLOT_PAD.right + LABEL_MARGIN}px`;
						break;
				}

				const labelBox = overlay.createDiv();
				labelBox.style.background = '#ffffff';
				labelBox.style.border = '0.5px solid #cccccc';
				labelBox.style.padding = '4px 8px';
				labelBox.style.display = 'inline-flex';
				labelBox.style.flexDirection = 'column';
				labelBox.style.gap = '3px';

				for (const eq of config.equations) {
					const row = labelBox.createDiv();
					row.style.display = 'flex';
					row.style.alignItems = 'center';
					row.style.gap = '6px';

					const bullet = row.createSpan();
					bullet.style.display = 'inline-block';
					bullet.style.width = '8px';
					bullet.style.height = '8px';
					bullet.style.flexShrink = '0';
					bullet.style.background = eq.lineColor;

					const mathEl = renderMath(toDisplayLatex(eq.rawEquation), false);
					row.appendChild(mathEl);

					if (eq.label) {
						const labelSpan = row.createSpan();
						labelSpan.textContent = eq.label;
						labelSpan.style.fontSize = '11px';
						labelSpan.style.color = '#666666';
						labelSpan.style.fontStyle = 'italic';
					}
				}

				if (config.params && Object.keys(config.params).length > 0) {
					const paramRow = labelBox.createDiv();
					paramRow.style.borderTop = '0.5px solid #e0e0e0';
					paramRow.style.paddingTop = '3px';
					paramRow.style.marginTop = '1px';
					const paramLatex = Object.entries(config.params)
						.map(([k, v]) => `${k} = ${parseFloat((v as number).toPrecision(4))}`)
						.join(',\\;');
					paramRow.appendChild(renderMath(paramLatex, false));
				}

				await finishRenderMath();
			}

			const observer = new ResizeObserver((entries) => {
				const w = entries[0].contentRect.width;
				if (w > 0) draw(w);
			});
			observer.observe(container);
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class GrapherSettingTab extends PluginSettingTab {
	plugin: GrapherPlugin;

	constructor(app: App, plugin: GrapherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Graph Template' });

		new Setting(containerEl)
			.setName('Default graph template')
			.setDesc('Content inserted by the "Grapher: Insert default graph" command.')
			.addTextArea(text => {
				text.inputEl.rows = 10;
				text.inputEl.style.width = '100%';
				text.inputEl.style.fontFamily = 'monospace';
				text.setValue(this.plugin.settings.graphTemplate)
					.onChange(async (value) => {
						this.plugin.settings.graphTemplate = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
