import { FoldingRange, FoldingRangeProvider, ProviderResult, TextDocument } from 'vscode'

type FoldingConfig = {
	begin?: string,
	end?: string,
	beginRegex?: string,
	endRegex?: string,
	offsetTop?: number,
}

type FoldingRegex = {
	begin: RegExp,
	end: RegExp
	offsetTop: number,
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
			if (configuration.beginRegex && configuration.endRegex) {
				this.regexes.push({
					begin: new RegExp(configuration.beginRegex),
					end: new RegExp(configuration.endRegex),
					offsetTop: configuration.offsetTop || 0,
				});
			} else if (configuration.begin && configuration.end) {
				this.regexes.push({
					begin: new RegExp(escapeRegex(configuration.begin)),
					end: new RegExp(escapeRegex(configuration.end)),
					offsetTop: configuration.offsetTop || 0,
				});
			}
		} catch (err) {
		}
	}

	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> {
		let foldingRanges = [];
		let stack: { t: number, i: number }[] = [];
		let findOfRegexp = function* (line: string, regexes: FoldingRegex[]) {
			let left = 0;
			while (true) {
				var str = regexes.map((regexp, i) => {
					return `(?<b${i}>${regexp.begin.source})|(?<e${i}>${regexp.end.source})`;
				}).join('|');
				let res = line.substring(left || 0).match(str) as { groups?: { [key: string]: string }, index?: number };
				if (res && res.groups) {
					left = left + (res.index || 0) + 1;
					for (let index = 0; index < regexes.length; index++) {
						if (res.groups['b' + (index)]) {
							yield { type: 1, regexp: regexes[index] };
							continue;
						}
						if (res.groups['e' + (index)]) {
							yield { type: 2, regexp: regexes[index] };
							continue;
						}
					}
				} else {
					break;
				}
			}
		}
		for (let i = 0; i < document.lineCount; i++) {
			for (const { type, regexp } of findOfRegexp(document.lineAt(i).text, this.regexes)) {
				switch (type) {
					case 1:
						stack.unshift({ t: regexp.offsetTop, i: i });
						break;
					case 2:
						let a = stack[0].i, b = i, c = stack[0].t;
						if (stack[0]) {
							if (a != b) {
								foldingRanges.push(new FoldingRange(a + c, b - 1));
							}
						}
						stack.shift();
						break;
				}
			}
		}
		return foldingRanges;
	}
}