/*
    TODO:
        1. 添加测试功能，支持单元测试
        2. 支持REPL模式
        3. 完善错误处理机制
*/

const { program } = require('commander')
const fs = require('fs')
const path = require('path')

// 词元类型
const TOKEN_UNKNOWN = 0,
    TOKEN_PLUS = 1,
    TOKEN_MINUS = 2,
    TOKEN_ASTERISK = 3,
    TOKEN_SLASH = 4,
    TOKEN_PERCENT = 5,
    TOKEN_LEFT_PAREN = 6,
    TOKEN_RIGHT_PAREN = 7,
    TOKEN_COMMA = 8,
    TOKEN_LITERAL = 9

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

class Reporter {
    constructor(source) {
        // 记录每一行的开始索引，用于打印信息
        // 使用二分查找
        this.linesInfo = []
    }

    reportError(column, line, error) {
        this.reportInfo(column, line, error)
    }

    reportNote(column, line, note) {
        this.reportInfo(column, line, note)
    }

    reportWarning(column, line, warning) {
        this.reportInfo(column, line, warning)
    }

    reportInfo(column, line, message) {}
}

class Parser {
    constructor() {
        this.source = null
        this.curPointer = 0
        this.peekTokens = []
        this.curLine = 1
        this.curColumn = 1
        this.reporter = new Reporter()
    }

    throwError(error) {
        this.reporter.reportError(this.curColumn, this.curLine, error)
    }

    throwNote(note) {
        this.reporter.reportNote(this.curColumn, this.curLine, note)
    }

    throwWarning(warning) {
        this.reporter.reportWarning(this.curColumn, this.curLine, warning)
    }

    parse(source) {
        const expressions = []
        this.source = source
        let token = this.peekToken()
        while (token) {
            if (token.type === TOKEN_COMMA) {
                this.eatToken(TOKEN_COMMA)
            } else {
                const expr = this.parseExpression()
                expressions.push(expr)
            }
            token = this.peekToken()
        }
        return expressions
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
        } else if (char === '#') {
            this.skipComment()
            return this.nextToken()
        } else if (char === ',') {
            this.curPointer++
            return this.makeToken(TOKEN_COMMA)
        }
        throw 'Unknown character: ' + char
    }

    skipSpaces() {
        let char = this.source.charAt(this.curPointer)
        while (/^[\s\t\n\r]$/.test(char)) {
            if (char === '\n') {
                this.curLine++
                this.curColumn = 1
            } else if (char !== '\r') {
                this.curColumn++
            }
            this.curPointer++
            char = this.source.charAt(this.curPointer)
        }
    }

    skipComment() {
        let char = this.source.charAt(this.curPointer)
        while (char !== '\n' && this.curPointer < this.source.length) {
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

        const value = parseInt(this.source.substr(this.curPointer, count))
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
                const lhs = this.evaluate(expression.lhs)
                const rhs = this.evaluate(expression.rhs)
                const operator = expression.operator
                return this.evaluateBinaryExpr(operator, lhs, rhs)
            }
            case AST_UNARY_EXPRESSION: {
                const operand = this.evaluate(expression.expr)
                const operator = expression.operator
                return this.evaluateUnaryExpr(operator, operand)
            }
            default:
                throw 'Unreachable!'
        }
    }

    evaluateBinaryExpr(operator, lhs, rhs) {
        switch (operator) {
            case TOKEN_PLUS:
                return lhs + rhs
            case TOKEN_MINUS:
                return lhs - rhs
            case TOKEN_ASTERISK:
                return lhs * rhs
            case TOKEN_SLASH:
                return lhs / rhs
            case TOKEN_PERCENT:
                return lhs % rhs
            default:
                // TODO: use throwError
                throw 'Undefined binary operator: ' + operator
        }
    }

    evaluateUnaryExpr(operator, operand) {
        switch (operator) {
            case TOKEN_MINUS:
                return -1 * operand
            default:
                throw 'Undefined unary operator: ' + operator
        }
    }

    printExpression(expr, indent = 0) {
        let content = ''
        for (let i = 0; i < indent; i++) {
            content += ' '
        }
        switch (expr.type) {
            case AST_LITERAL:
                content += `AST_LITERAL (value=${expr.operand})`
                break
            case AST_BINARY_EXPRESSION: {
                const operator = this.printOperator(expr.operator)
                content += `AST_BINARY_EXPRESSION (operator ${operator})`
                console.log(content)
                this.printExpression(expr.lhs, indent + 2)
                this.printExpression(expr.rhs, indent + 2)
                return
            }
            case AST_UNARY_EXPRESSION: {
                const operator = this.printOperator(expr.operator)
                content += `AST_UNARY_EXPRESSION (operator ${operator})`
                console.log(content)
                this.printExpression(expr.expr, indent + 2)
                return
            }
            default:
                throw 'Unreachable!'
        }
        console.log(content)
    }

    printOperator(operator) {
        switch (operator) {
            case TOKEN_PLUS:
                return '+'
            case TOKEN_MINUS:
                return '-'
            case TOKEN_ASTERISK:
                return '*'
            case TOKEN_SLASH:
                return '/'
            case TOKEN_PERCENT:
                return '%'
            default:
                throw 'Unknown operator: ' + operator
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
        console.log(token, this.curColumn, this.curLine)
        throw `Unexpected token: ${token}`
    }

    parseBinaryExpression(precedence = 0) {
        let leftExpr = this.parseUnaryExpression()

        const token = this.peekToken()
        if (!token || token.type === TOKEN_COMMA) {
            return leftExpr
        }

        let curPrecedence = this.getPrecedence(token.type)
        while (curPrecedence > precedence) {
            let opToken = this.nextToken()
            const rightExpr = this.parseBinaryExpression(curPrecedence)

            leftExpr = this.makeNode(AST_BINARY_EXPRESSION, { lhs: leftExpr, operator: opToken.type, rhs: rightExpr })

            opToken = this.peekToken()
            if (!opToken || opToken.type === TOKEN_COMMA) {
                if (opToken) {
                    this.eatToken(TOKEN_COMMA)
                }
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

        return this.makeNode(AST_UNARY_EXPRESSION, { operator: operator.type, expr })
    }

    getPrecedence(operator) {
        if (!(operator in PRECEDENCE_TABLE)) {
            return -1
        }
        return PRECEDENCE_TABLE[operator]
    }
}

const runTest = filepath => {
    const parser = new Parser()
    const content = fs.readFileSync(filepath, { encoding: 'utf-8' })
    const exprs = parser.parse(content)
    const matches = content.matchAll(/expect:\s*(-?\d+)/g)
    const expects = []
    for (const match of matches) {
        expects.push(parseInt(match[1]))
    }
    for (let i = 0; i < exprs.length; i++) {
        const value = parser.evaluate(exprs[i])
        if (value !== expects[i]) {
            console.log(`Test failed, Unexpected result: ${value}, expect: ${expects[i]}`)
            return false
        }
    }
    console.log(`Test complete, ${expects.length} subtests`)
    return true
}

program
    .argument('<file>', 'expression file to parse')
    .option('-v, --verbose', 'Output every detail when parsing expression.')
    .version('0.0.1')
    .action(file => {
        const parser = new Parser()
        const content = fs.readFileSync(file, { encoding: 'utf-8' })
        const exprs = parser.parse(content)
        for (const expr of exprs) {
            console.log(`Result is ${parser.evaluate(expr)}`)
        }
    })

program
    .command('test [testDir]')
    .description('Do unit testing')
    .action((testDir) => {
        const unitTestsDir = testDir || './tests'
        const testFiles = fs.readdirSync(unitTestsDir)
        let success = 0, failed = 0
        for (const testFile of testFiles) {
            const filepath = path.join(unitTestsDir, testFile)
            const result = runTest(filepath)
            if (result) {
                success++
            } else {
                failed++
            }
        }
        console.log(`Unit testing running complete, Total tests: ${testFiles.length}, Success: ${success}, Failed: ${failed}`)
    })

program
    .command('repl')
    .description('Run the expression parser in REPL mode')
    .action(() => {})

program.parse(process.argv)
