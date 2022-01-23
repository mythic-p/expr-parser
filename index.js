/*
    TODO:
        1. 支持内置数学函数调用
        2. 支持声明变量，调用变量
*/

const { program } = require('commander')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

// 词元类型
const TOKEN_EOF = 0,
    TOKEN_PLUS = 1,
    TOKEN_MINUS = 2,
    TOKEN_ASTERISK = 3,
    TOKEN_SLASH = 4,
    TOKEN_PERCENT = 5,
    TOKEN_LEFT_PAREN = 6,
    TOKEN_RIGHT_PAREN = 7,
    TOKEN_COMMA = 8,
    TOKEN_LITERAL = 9

// 字面量属性
const LITERAL_FLAG_INTEGER = 0x01,
    LITERAL_FLAG_DOUBLE = 0x02

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

// 将值转换成对应的字符串内容
// value可以是词元对象，也可以词元的类型
// 如果输入的是词元类型，则需要设置isType为true
const tokenToString = (value, isType = false) => {
    switch (isType ? value : value.type) {
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
        case TOKEN_COMMA:
            return ','
        case TOKEN_LEFT_PAREN:
            return '('
        case TOKEN_RIGHT_PAREN:
            return ')'
        case TOKEN_LITERAL: {
            const { value } = token.value
            return value
        }
        case TOKEN_EOF:
            return '<EOF>'
        default:
            throw 'Unimplemented token: ' + value
    }
}

// 错误报告器
class Reporter {
    constructor() {
        // 记录每一行的开始索引，用于打印信息
        this.linesInfo = null
    }

    reportError(column, line, error) {
        this.reportInfo('error', column, line, error)
    }

    reportNote(column, line, note) {
        this.reportInfo('note', column, line, note)
    }

    reportWarning(column, line, warning) {
        this.reportInfo('warning', column, line, warning)
    }

    reportInfo(label, column, line, message) {
        const content = this.findLine(line).trim()
        console.log(`\t\t${content}`)
        let arrowStr = '\t\t'
        for (let i = 0; i < column - 1; i++) {
            arrowStr += ' '
        }
        arrowStr += '^'
        console.log(arrowStr)
        console.log(`todo:${line}:${column}: ${label}: ${message}`)
        throw ''
    }

    loadLineInfo(source) {
        this.source = source
        this.linesInfo = []

        let lastIndex = 0

        for (let i = 0; i < source.length; i++) {
            const char = source.charAt(i)
            if (char === '\n') {
                this.linesInfo.push(lastIndex)
                lastIndex = i
            }
        }

        this.linesInfo.push(lastIndex)

        return true
    }

    findLine(line) {
        const totalLines = this.linesInfo.length
        let pos = line - 1
        if (pos >= totalLines) {
            return null
        }

        let endPos = this.source.length
        if (pos + 1 < totalLines) {
            endPos = this.linesInfo[pos + 1]
        }

        pos = this.linesInfo[pos]
        return this.source.substring(pos, endPos)
    }
}

// 解释器
class Interpreter {}

// 解析器
class Parser {
    constructor() {
        this.source = null
        this.reporter = new Reporter()
        this.resetState()
    }

    throwError(error, token = null) {
        this.throwInfo(0, error, token)
    }

    throwNote(note, token = null) {
        this.throwInfo(1, note, token)
    }

    throwWarning(warning, token = null) {
        this.throwInfo(2, warning, token)
    }

    throwInfo(type, message, token = null) {
        let reportFn = null
        switch (type) {
            case 0: // error
                reportFn = this.reporter.reportError
                break
            case 1: // note
                reportFn = this.reporter.reportNote
                break
            case 2: // warning
                reportFn = this.reporter.reportWarning
                break
            default:
                throw 'Unimplemented throw type'
        }
        const column = token ? token.column : this.curColumn,
            line = token ? token.line : this.curLine
        reportFn.call(this.reporter, column, line, message)
    }

    parse(source) {
        const expressions = []
        this.source = source
        this.reporter.loadLineInfo(source)
        this.resetState()
        let token = this.peekToken()
        while (token.type !== TOKEN_EOF) {
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

    resetState() {
        this.curPointer = 0
        this.peekTokens = []
        this.curLine = 1
        this.curColumn = 1
    }

    makeToken(type, value = null) {
        // 存储词元的类型，具体数值
        // 词元的起始行号和列号
        return { type, value, column: this.curColumn, line: this.curLine }
    }

    nextToken() {
        const length = this.source.length
        if (this.peekTokens.length >= 1) {
            return this.peekTokens.shift()
        }
        if (this.curPointer >= length) {
            return this.makeToken(TOKEN_EOF)
        }
        this.skipSpaces()
        const char = this.source.charAt(this.curPointer)
        if (this.isNumberLiteral(char)) {
            return this.nextNumberLiteral()
        } else if (this.isOperator(char)) {
            return this.nextOperator()
        } else if (char === '(') {
            this.curPointer++
            const leftParenToken = this.makeToken(TOKEN_LEFT_PAREN)
            this.curColumn++
            return leftParenToken
        } else if (char === ')') {
            this.curPointer++
            const rightParenToken = this.makeToken(TOKEN_RIGHT_PAREN)
            this.curColumn++
            return rightParenToken
        } else if (char === '#') {
            this.skipComment()
            return this.nextToken()
        } else if (char === ',') {
            this.curPointer++
            const commaToken = this.makeToken(TOKEN_COMMA)
            this.curColumn++
            return commaToken
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
        return /^[+\-*/%]$/.test(character)
    }

    nextNumberLiteral() {
        let count = 0
        let char = this.source.charAt(this.curPointer)

        let flags = LITERAL_FLAG_INTEGER

        while (this.isNumberLiteral(char)) {
            count++
            char = this.source.charAt(this.curPointer + count)
            if (char === '.') {
                if (flags & LITERAL_FLAG_INTEGER) {
                    flags &= ~LITERAL_FLAG_INTEGER
                    flags |= LITERAL_FLAG_DOUBLE
                } else {
                    this.throwError('Lexical error: Invalid number format!')
                }
            }
        }

        const parseFn = (flags & LITERAL_FLAG_INTEGER) ? parseInt : parseFloat
        const value = parseFn(this.source.substr(this.curPointer, count))
        this.curPointer += count

        const literalToken = this.makeToken(TOKEN_LITERAL, { value, flags })
        this.curColumn += count

        return literalToken
    }

    nextOperator() {
        const char = this.source.charAt(this.curPointer)
        const type = OPERATOR_TABLE[char]
        if (!type) {
            return null
        }

        this.curPointer++

        const operatorToken = this.makeToken(type)
        this.curColumn++

        return operatorToken
    }

    eatToken(type) {
        const token = this.nextToken()
        if (token.type !== type) {
            const unexpectedToken = tokenToString(token),
                expectedToken = tokenToString(type, true)
            this.throwError(`Unexpected token: ${unexpectedToken}, expect token: ${expectedToken}`)
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
        if (token.type === TOKEN_EOF) {
            return token
        }
        this.peekTokens.push(token)
        return token
    }

    // 根据抽象语法树计算表达式的值
    evaluate(expression) {
        switch (expression.type) {
            case AST_LITERAL: {
                const { operand, flags } = expression
                return { operand, flags }
            }
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
        const leftOperand = lhs.operand,
            leftFlags = lhs.flags,
            rightOperand = rhs.operand,
            rightFlags = rhs.flags
        switch (operator) {
            case TOKEN_PLUS:
                return leftOperand + rightOperand
            case TOKEN_MINUS:
                return leftOperand - rightOperand
            case TOKEN_ASTERISK:
                return leftOperand * rightOperand
            case TOKEN_SLASH: {
                const isIntegerDivision = this.hasFlag(leftFlags, LITERAL_FLAG_INTEGER) && this.hasFlag(rightFlags, LITERAL_FLAG_INTEGER)
                if (isIntegerDivision) {
                    return (leftOperand / rightOperand) >>> 0                    
                }
                return leftOperand / rightOperand
            }
            case TOKEN_PERCENT: {
                const lhsIsInteger = this.hasFlag(leftFlags, LITERAL_FLAG_INTEGER),
                    rhsIsInteger = this.hasFlag(rightFlags, LITERAL_FLAG_INTEGER)
                if (!lhsIsInteger || !rhsIsInteger) {
                    this.throwError('Modulo operation can only apply on integer value!')
                    this.throwNote('The left-hand side value type is <TODO>')
                    this.throwNote('The right-hand side value type is <TODO>')
                    return
                }
                return leftOperand % rightOperand
            }
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

    hasFlag(flags, flag) {
        return flags & flag === flag
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
        const type = token ? token.type : -1
        if (type === TOKEN_LEFT_PAREN) {
            this.eatToken(TOKEN_LEFT_PAREN)
            const expr = this.parseExpression()
            this.eatToken(TOKEN_RIGHT_PAREN)
            return expr
        } else if (type === TOKEN_LITERAL) {
            this.eatToken(TOKEN_LITERAL)
            const { value, flags } = token.value
            return this.makeNode(AST_LITERAL, { operand: value, flags })
        }
        this.throwError(`Expect a primary expression, but got ${tokenToString(token)}`, token)
    }

    parseBinaryExpression(precedence = 0) {
        let leftExpr = this.parseUnaryExpression()

        const token = this.peekToken()
        if (token.type === TOKEN_EOF || token.type === TOKEN_COMMA || token.type === TOKEN_RIGHT_PAREN) {
            return leftExpr
        }

        let curPrecedence = this.getPrecedence(token.type)
        while (curPrecedence > precedence) {
            let opToken = this.nextToken()
            const rightExpr = this.parseBinaryExpression(curPrecedence)

            leftExpr = this.makeNode(AST_BINARY_EXPRESSION, { lhs: leftExpr, operator: opToken.type, rhs: rightExpr })

            opToken = this.peekToken()
            if (opToken.type === TOKEN_EOF || opToken.type === TOKEN_COMMA || opToken.type === TOKEN_RIGHT_PAREN) {
                if (opToken.type === TOKEN_COMMA) {
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
    .action(() => {
        const interface = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        const parser = new Parser()
        interface.on('line', input => {
             const exprs = parser.parse(input)
             for (const expr of exprs) {
                console.log(parser.evaluate(expr))
             }
        })
    })

program.parse(process.argv)
