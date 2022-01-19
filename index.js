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
	[TOKEN_PERCENT]: 2
}

// 运算符映射表
const OPERATOR_TABLE = {
	'+': TOKEN_PLUS,
	'-': TOKEN_MINUS,
	'*': TOKEN_ASTERISK,
	'/': TOKEN_SLASH,
	'%': TOKEN_PERCENT
}

// 工具类
const throwError = (line, column, message) => {}

const throwNote = (line, column, note) => {}

class Parser {
	constructor() {
		this.source = null
		this.curPointer = 0
		this.peekTokens = []
	}

	parse(source) {
		this.source = source
		const expr = this.parseExpression()
		console.log(expr)
		// this.evaluate(expr)
		console.log('Parse ended!')
	}

	makeToken(type, value = null) {
		return { type, value }
	}

	nextToken() {
		const length = this.source.length
		if (this.peekTokens.length >= 1) {
			return this.peekTokens.shift()
		}
		if (this.curPointer >= length) {
			return null
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
		let count = 0
		let char = this.source.charAt(this.curPointer)

		while (this.isNumberLiteral(char)) {
			count++
			char = this.source.charAt(this.curPointer + count)
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
			// TODO: Use throwError instead of plain string
			throw `Unexpected token: ${token}, expected type: ${type}`
		}
		return token
	}

	peekToken(peekAmount = 1) {
		if (peekAmount <= 0) {
			return null
		}
		if (this.peekTokens.length >= peekAmount) {
			const peekPosition = peekAmount - 1
			return this.peekTokens[peekPosition]
		}
		const token = this.nextToken()
		if (!token) {
			return null
		}
		this.peekTokens.push(token)
		return token
	}

	// 根据抽象语法树计算表达式的值
	evaluate(expression) {
		switch (expression.type) {
			case AST_LITERAL:
				return expression.operand
			case AST_BINARY_EXPRESSION: {
				const lhsValue = this.evaluate(expression.lhs)
				const rhsValue = this.evaluate(expression.rhs)
				// 
			}
			case AST_UNARY_EXPRESSION: {
				const subExprValue = this.evaluate(expression.expr)
				// 
			}
		}
	}

	makeNode(type, body) {
		const node = { type, ...body }

		return node
	}

	// 解析表达式
	parseExpression(precedence = 0) {
		return this.parseBinaryExpression(precedence)
	}

	// Primary expression ->
	// '(' expression ')' |
	// LITERAL
	parsePrimaryExpression() {	
		const token = this.peekToken()
		if (token.type === TOKEN_LEFT_PAREN) {
			this.eatToken(TOKEN_LEFT_PAREN)
			const expr = this.parseExpression()
			this.eatToken(TOKEN_RIGHT_PAREN)
			return expr
		} else if (token.type === TOKEN_LITERAL) {
			this.eatToken(TOKEN_LITERAL)
			return this.makeNode(AST_LITERAL, { operand: token.value })
		}
		throw `Unexpected token: ${token}`
	}

	parseBinaryExpression(precedence = 0) {
		let leftExpr = this.parseUnaryExpression()

		const token = this.peekToken()
		if (!token) {
			return leftExpr
		}

		let curPrecedence = this.getPrecedence(token.type)
		while (curPrecedence > precedence) {
			let opToken = this.nextToken()
			const rightExpr = this.parseBinaryExpression(curPrecedence)

			leftExpr = this.makeNode(AST_BINARY_EXPRESSION, { lhs: leftExpr, operator: opToken.type, rhs: rightExpr })

			opToken = this.peekToken()
			if (!opToken) {
				return leftExpr
			}
			curPrecedence = this.getPrecedence(opToken.type)
		}

		return leftExpr
	}

	parseUnaryExpression() {
		const token = this.peekToken()
		if (token.type !== TOKEN_MINUS) {
			return this.parsePrimaryExpression()
		}
		const operator = this.nextToken()
		const expr = this.parseUnaryExpression()

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
