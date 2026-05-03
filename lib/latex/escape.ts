const latexEscapeMap: Record<string, string> = {
	"\\": "\\textbackslash{}",
	"&": "\\&",
	"%": "\\%",
	$: "\\$",
	"#": "\\#",
	_: "\\_",
	"{": "\\{",
	"}": "\\}",
	"~": "\\textasciitilde{}",
	"^": "\\textasciicircum{}",
};

export function latexEscape(value: string) {
	return value.replace(/[\\&%$#_{}~^]/g, (character) => latexEscapeMap[character] ?? character);
}
