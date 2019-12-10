import { FoldingRange, FoldingRangeProvider, ProviderResult, TextDocument } from 'vscode'

type FoldingConfig = {
	begin?: string,
	end?: string,
	skipLine?: string,
	skipBegin?: string,
	skipEnd?: string,
	beginRegex?: string,
	endRegex?: string,
	skipLineRegex?: string,
	skipBeginRegex?: string,
	skipEndRegex?: string,
	offsetTop?: number,
	offsetBottom?: number,
}
type FoldingRegex = {
	begin: RegExp,
	end: RegExp,
	skipLine: string,
	skipBegin: string,
	skipEnd: string,
	offsetTop: number,
	offsetBottom: number,
}

const matchOperatorRegex = /[-|\\{}()[\]^$+*?.]/g;

function escapeRegex(str: string) {
	return str.replace(matchOperatorRegex, '\\$&');
}

export default class ConfigurableFoldingProvider implements FoldingRangeProvider {
	private regexes: Array<FoldingRegex> = [];

	constructor(configuration: FoldingConfig | Array<FoldingConfig>) {
		if (configuration instanceof Array) {
			for (let value of configuration) {
				this.addRegex(value);
			}
		} else {
			this.addRegex(configuration);
		}

	}

	private addRegex(configuration: FoldingConfig) {
		try {
			if (configuration.begin && configuration.end) {
				this.regexes.push({
					begin: new RegExp(escapeRegex(configuration.begin)),
					end: new RegExp(escapeRegex(configuration.end)),
					skipLine: (configuration.skipLine ? escapeRegex(configuration.skipLine) : configuration.skipLineRegex || ''),
					skipBegin: (configuration.skipBegin ? escapeRegex(configuration.skipBegin) : configuration.skipBeginRegex || ''),
					skipEnd: (configuration.skipEnd ? escapeRegex(configuration.skipEnd) : configuration.skipEndRegex || ''),
					offsetTop: configuration.offsetTop || 0,
					offsetBottom: configuration.offsetBottom || 0,
				});
			} else if (configuration.beginRegex && configuration.endRegex) {
				this.regexes.push({
					begin: new RegExp(configuration.beginRegex),
					end: new RegExp(configuration.endRegex),
					skipLine: (configuration.skipLine ? escapeRegex(configuration.skipLine) : configuration.skipLineRegex || ''),
					skipBegin: (configuration.skipBegin ? escapeRegex(configuration.skipBegin) : configuration.skipBeginRegex || ''),
					skipEnd: (configuration.skipEnd ? escapeRegex(configuration.skipEnd) : configuration.skipEndRegex || ''),
					offsetTop: configuration.offsetTop || 0,
					offsetBottom: configuration.offsetBottom || 0,
				});
			}
		} catch (err) {
		}
	}
	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> {
		const BEGIN = 1;
		const END = 2;
		const COMMENT = 3;
		let foldingRanges = [];
		let stack: { r: FoldingRegex, i: number }[] = [];
		var regstr = this.regexes.map((regexp, i) => `(?<_${BEGIN}_${i}>${regexp.begin.source})|(?<_${END}_${i}>${regexp.end.source})` + (regexp.skipLine ? `|(?<_${COMMENT}_${i}>${regexp.skipLine})` : '')).join('|');
		let findOfRegexp = function* (line: string, str: string) {
			let left = 0;
			while (true) {
				let res = line.substring(left || 0).match(str) as { groups?: { [key: string]: string }, index?: number, [key: number]: string };
				if (res && res.groups) {
					left = left + (res.index || 0) + res[0].length;
					for (const key in res.groups) {
						if (res.groups[key]) {
							let keys = key.split('_').map(x => parseInt(x));
							yield { type: keys[1], index: keys[2] };
							break;
						}
					}
				} else {
					break;
				}
			}
		}
		for (let i = 0; i < document.lineCount; i++) {
			for (const { type, index } of findOfRegexp(document.lineAt(i).text, regstr)) {
				if (type == COMMENT) {
					break;
				}
				if (type == BEGIN) {
					stack.unshift({ r: this.regexes[index], i: i });
					continue;
				}
				if (type == END && stack[0]) {
					let a = stack[0].i, b = i, c = stack[0].r.offsetTop, d = stack[0].r.offsetBottom, rr = this.regexes[index];
					while (1) {
						if (a == b) {
							break;
						}
						if (stack[0].r != rr) {
							let tmp = stack.slice();
							while (tmp.length && tmp[0].r != rr) {
								tmp.shift();
							}
							if (tmp.length) {
								stack = tmp;
							} else {
								break;
							}
						}
						if (rr.skipBegin && document.lineAt(a).text.match(rr.skipBegin)) {
							break;
						}
						if (rr.skipEnd && document.lineAt(b).text.match(rr.skipEnd)) {
							break;
						}
						foldingRanges.push(new FoldingRange(a + c, b - 1 + d));
						break;
					}
					stack.shift();
					continue;
				}
			}
		}
		return foldingRanges;
	}
}