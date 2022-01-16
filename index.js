const { program } = require('commander')

class Parser {
	constructor() {}
}

program
	.argument('<file>', 'expression file to parse')
	.option('-V, --verbose', 'Output every detail when parsing expression.')
	.version('0.0.1')
	.action(file => {
		console.log(file)
	})

program.parse(process.argv)
