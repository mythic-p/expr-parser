const { program } = require('commander')
const fs = require('fs')

// 词元类型
const TOKEN_UNKNOWN = 0,
	TOKEN_PLUS = 1,
	TOKEN_MINUS = 2,
	TOKEN_ASTERISK = 3,
	TOKEN_SLASH = 4,
	TOKEN_PERCENT = 5,
	TOKEN_LEFT_PAREN = 6,
	TOKEN_RIGHT_PAREN = 7
	TOKEN_LITERAL = 8

// 语法树节点
const AST_UNARY_EXPRESSION = 1,
	AST_BINARY_EXPRESSION = 2,
	AST_LITERAL = 3

// 操作符优先级
// 优先级是对于双目运算符来说
const PRECEDENCE_TABLE = {
	[TOKEN_PLUS]: 1,
	[TOKEN_MINUS]: 1,
	[TOKEN_ASTERISK]: 2,
	[TOKEN_SLASH]: 2,
	[TOKEN_PERCENT]: 3
}

// 运算符映射表
const OPERATOR_TABLE = {
	'+': TOKEN_PLUS,
	'-': TOKEN_MINUS,
	'*': TOKEN_ASTERISK,
	'/': TOKEN_SLASH,
	'%': TOKEN_PERCENT
}

class Parser {
	constructor() {
		this.source = null
		this.curPointer = 0
		this.peekTokens = []
	}

	parse(source) {
		this.source = source
		while (1) {
			const expr = this.parseExpression()
			if (!expr) {
				break
			}
			this.evaluate(expr)
		}
		console.log('Parse ended!')
	}

	makeToken(type, value = null) {
		return { type, value }
	}

	nextToken() {
		const length = this.source.length
		if (this.curPointer >= length) {
			return null
		}
		if (this.peekTokens.length >= 1) {
			return this.peekTokens.unshift()
		}
		this.skipSpaces()
		const char = this.source.charAt(this.curPointer)
		if (this.isNumberLiteral(char)) {
			return this.nextNumberLiteral()
		} else if (this.isOperator(char)) {
			return this.nextOperator()
		} else if (char === '(') {
			this.curPointer++
			return this.makeToken(TOKEN_LEFT_PAREN)
		} else if (char === ')') {
			this.curPointer++
			return this.makeToken(TOKEN_RIGHT_PAREN)
		}
		throw 'Unknown character: ' + char
	}

	skipSpaces() {
		let char = this.source.charAt(this.curPointer)
		while (char === ' ') {
			this.curPointer++
			char = this.source.charAt(this.curPointer)
		}
	}

	isNumberLiteral(character) {
		return /^[0-9.]$/.test(character)
	}

	isOperator(character) {
		return /^[+\-*/]$/.test(character)
	}

	nextNumberLiteral() {
		let count = 1
		let char = this.source.charAt(this.curPointer)

		while (this.isNumberLiteral(char)) {
			count++
			char = this.source.charAt(count)
		}

		const value = this.source.substr(this.curPointer, count)
		this.curPointer += count

		return this.makeToken(TOKEN_LITERAL, value)
	}

	nextOperator() {
		const char = this.source.charAt(this.curPointer)
		const type = OPERATOR_TABLE[char]
		if (!type) {
			return null
		}

		this.curPointer++

		return this.makeToken(type)
	}

	eatToken(type) {
		const token = this.nextToken()
		if (token.type !== type) {
			throw ''
		}
		return token
	}

	peekToken(peekAmount = 1) {
		if (peekAmount <= 0) {
			return null
		}
		const token = this.nextToken()
		this.peekTokens.push(token)
		return token
	}

	// 根据抽象语法树计算表达式的值
	evaluate(expression) {}

	makeNode(type, body) {
		const node = { type, ...body }

		return node
	}

	// 解析表达式
	parseExpression(precedence = 0) {
		const token = this.peekToken()
		if (token.type !== TOKEN_LITERAL) {
			return this.parseUnaryExpression()
		}

		return this.parseBinaryExpression()
	}

	parsePrimaryExpression() {
		//
	}

	parseBinaryExpression() {}

	parseUnaryExpression() {
		const operator = this.nextToken()
		if (operator.type === TOKEN_LITERAL) {
			throw ''
		}
		const expr = this.parseExpression()

		return this.makeNode(AST_UNARY_EXPRESSION, { operator, expr })
	}

	getPrecedence(operator) {
		if (!(operator in PRECEDENCE_TABLE)) {
			return -1
		}
		return PRECEDENCE_TABLE[operator]
	}
}

program
	.argument('<file>', 'expression file to parse')
	.option('-V, --verbose', 'Output every detail when parsing expression.')
	.version('0.0.1')
	.action(file => {
		const parser = new Parser()
		const content = fs.readFileSync(file, { encoding: 'utf-8' })
		// parser.source = content
		parser.parse(content)
		// let token = parser.nextToken()
		// while (token) {
		// 	console.log(token)
		// 	token = parser.nextToken()
		// }
	})

program.parse(process.argv)
