/*
    TODO:
        1. 支持声明变量，调用变量
        2. 将解析器中求值相关函数解耦
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
    TOKEN_ASSIGN = 9,
    TOKEN_VAR = 10,
    TOKEN_LITERAL = 11,
    TOKEN_IDENTIFIER = 12

// 字面量属性
const LITERAL_FLAG_INTEGER = 0x01,
    LITERAL_FLAG_DOUBLE = 0x02

// 语法树节点
const AST_UNARY_EXPRESSION = 1,
    AST_BINARY_EXPRESSION = 2,
    AST_LITERAL = 3,
    AST_IDENTIFIER = 4,
    AST_FUNCTION_CALL = 5,
    AST_VARIABLE_DECLARATION = 6

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

// 内置数学函数
const BUILTIN_FNS = {
    'cos': Math.cos,
    'sin': Math.sin,
    'sqrt': Math.sqrt,
    'pow': Math.pow
}

// 关键字 -> 词元类型映射表
const KEYWORD_MAPPING = {
    'var': TOKEN_VAR
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
        case TOKEN_ASSIGN:
            return '='
        case TOKEN_LITERAL: {
            const { value } = value.value
            return value
        }
        case TOKEN_EOF:
            return '<EOF>'
        case TOKEN_VAR:
            return 'var'
        case TOKEN_IDENTIFIER:
            return value.value
        default:
            throw 'Unimplemented token: ' + value
    }
}

const literalFlagsToString = flags => {
    if (flags & LITERAL_FLAG_INTEGER) {
        return 'Integer'
    } else if (flags & LITERAL_FLAG_DOUBLE) {
        return 'Double'
    }
    return '<TODO>'
}

// 错误报告器
class Reporter {
    constructor(filepath) {
        // 记录每一行的开始索引，用于打印信息
        this.linesInfo = null
        this.notes = []
        this.filename = path.basename(filepath)
    }

    reportError(column, line, error) {
        this.reportInfo('error', column, line, error, true)
    }

    reportNote(column, line, message) {
        const note = { column, line, message }
        this.notes.push(note)
    }

    reportWarning(column, line, warning) {
        this.reportInfo('warning', column, line, warning)
    }

    reportInfo(label, column, line, message, interrupt = false) {
        const content = this.findLine(line).trim()
        console.log(`\t\t${content}`)
        let arrowStr = '\t\t'
        for (let i = 0; i < column - 1; i++) {
            arrowStr += ' '
        }
        arrowStr += '^'
        console.log(arrowStr)
        console.log(`${this.filename}:${line}:${column}: ${label}: ${message}\n`)
        if (interrupt) {
            for (const note of this.notes) {
                this.reportInfo('note', note.column, note.line, note.message)
            }
            throw ''
        }
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
class Interpreter {
    constructor() {
        this.variables = new Map()
    }

    resetState() {}

    interpret(statement, isRoot = false) {
        let result

        switch (statement.type) {
            case AST_LITERAL: {

                break
            }
            case AST_BINARY_EXPRESSION:
                break
            case AST_UNARY_EXPRESSION:
                break
        }

        return result
    }

    interpretLiteral(literal) {}

    interpretBinaryExpression(binaryExpr) {}

    interpretUnaryExpression(unaryExpr) {}

    interpretFunctionCall(functionCall) {}
}

// 解析器
class Parser {
    constructor(filepath) {
        this.source = null
        this.reporter = new Reporter(filepath)
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
        const statements = []
        this.source = source
        this.reporter.loadLineInfo(source)
        this.resetState()
        let token = this.peekToken()
        while (token.type !== TOKEN_EOF) {
            const statement = this.parseStatement()
            token = this.peekToken()
            statements.push(statement)
        }
        return statements
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
        } else if (this.isIdentifier(char, true)) {
            return this.nextIdentifier()
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
        } else if (char === '=') {
            this.curPointer++
            const assignToken = this.makeToken(TOKEN_ASSIGN)
            this.curColumn++
            return assignToken
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

    isIdentifier(character, isStart = false) {
        if (isStart) {
            return /^[a-zA-Z_]$/.test(character)            
        }

        return /^[a-zA-Z0-9_]$/.test(character)
    }

    isKeyword(type) {
        return type >= TOKEN_VAR && type < TOKEN_LITERAL
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

    nextIdentifier() {
        let count = 1,
            char = this.source.charAt(this.curPointer + 1)
        const column = this.curColumn, line = this.curLine

        while (this.isIdentifier(char)) {
            count++
            char = this.source.charAt(this.curPointer + count)
        }

        const identifier = this.source.substr(this.curPointer, count)
        const token = this.makeToken(TOKEN_IDENTIFIER, identifier)

        this.curPointer += count
        this.curColumn += count

        // 标识符有可能是关键字，尝试转换成关键字专门的词元类型
        this.matchKeyword(token)

        return token
    }

    matchKeyword(token) {
        const name = token.value
        const mappedType = KEYWORD_MAPPING[name]
        if (mappedType) {
            token.type = mappedType
        }
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
    evaluate(expression, isRoot = false) {
        switch (expression.type) {
            case AST_LITERAL: {
                return isRoot ? expression.operand : expression
            }
            case AST_BINARY_EXPRESSION: {
                const lhs = this.evaluate(expression.lhs)
                const rhs = this.evaluate(expression.rhs)
                const operator = expression.operator
                let result = this.evaluateBinaryExpr(operator, lhs, rhs)
                if (isRoot) {
                    return result.operand
                }
                return result
            }
            case AST_UNARY_EXPRESSION: {
                const operand = this.evaluate(expression.expr)
                const operator = expression.operator
                const result = this.evaluateUnaryExpr(operator, operand)
                if (isRoot) {
                    return result.operand
                }
                return result
            }
            case AST_FUNCTION_CALL: {
                const { identifier, arguments: args } = expression
                const result = this.evaluateFunctionCall(identifier, args)
                if (isRoot) {
                    return result.operand
                }

                return result
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
        let operand, flags
        const isBothInteger = this.hasFlag(leftFlags, LITERAL_FLAG_INTEGER) && this.hasFlag(rightFlags, LITERAL_FLAG_INTEGER)
        if (isBothInteger) {
            flags = LITERAL_FLAG_INTEGER
        } else {
            flags = LITERAL_FLAG_DOUBLE
        }
        switch (operator.type) {
            case TOKEN_PLUS:
                operand = leftOperand + rightOperand
                break
            case TOKEN_MINUS:
                operand = leftOperand - rightOperand
                break
            case TOKEN_ASTERISK:
                operand = leftOperand * rightOperand
                break
            case TOKEN_SLASH: {
                operand = leftOperand / rightOperand
                if (isBothInteger) {
                    operand >>>= 0
                }
                break
            }
            case TOKEN_PERCENT: {
                if (!isBothInteger) {
                    const lhsType = literalFlagsToString(leftFlags),
                        rhsType = literalFlagsToString(rightFlags)
                    this.throwNote(`The left-hand side value type is ${lhsType}`, lhs)
                    this.throwNote(`The right-hand side value type is ${rhsType}`, rhs)
                    this.throwError('Modulo operation can only apply on integer value!', operator)
                }
                operand = leftOperand % rightOperand
                break
            }
            default:
                this.throwError(`Undefined binary operator: ${tokenToString(operator)}`, operator)
        }

        const result = { operand, flags }

        return result
    }

    evaluateUnaryExpr(operator, operand) {
        const flags = operand.flags
        let value
        switch (operator.type) {
            case TOKEN_MINUS:
                value = -1 * operand.operand
                break
            default:
                throw 'Undefined unary operator: ' + operator
        }

        return { flags, operand: value }
    }

    evaluateFunctionCall(identifier, params) {
        const { value: name, column, line } = identifier
        const calledFn = BUILTIN_FNS[name]
        if (!calledFn) {
            this.throwError(`Undefined function name: ${name}`, identifier)
        }
        const args = []
        for (const param of params) {
            const arg = this.evaluate(param, true)
            args.push(arg)
        }
        const result = calledFn.apply(this, args)

        return { operand: result, column, line, flags: LITERAL_FLAG_DOUBLE }
    }

    printStatement(statement, indent = 0) {
        let content = ''
        for (let i = 0; i < indent; i++) {
            content += ' '
        }
        switch (statement.type) {
            case AST_LITERAL:
                content += `AST_LITERAL (value=${statement.operand})`
                break
            case AST_BINARY_EXPRESSION: {
                const operator = this.printOperator(statement.operator.type)
                content += `AST_BINARY_EXPRESSION (operator ${operator})`
                console.log(content)
                this.printStatement(statement.lhs, indent + 2)
                this.printStatement(statement.rhs, indent + 2)
                return
            }
            case AST_UNARY_EXPRESSION: {
                const operator = this.printOperator(statement.operator.type)
                content += `AST_UNARY_EXPRESSION (operator ${operator})`
                console.log(content)
                this.printStatement(statement.expr, indent + 2)
                return
            }
            case AST_IDENTIFIER:
                content += `AST_IDENTIFIER (value=${statement.value})`
                break
            case AST_FUNCTION_CALL: {
                const { value } = statement.identifier
                content += `AST_FUNCTION_CALL (name=${value}, num_args=${statement.arguments.length})`
                console.log(content)
                for (const arg of statement.arguments) {
                    this.printStatement(arg, indent + 2)
                }
                return
            }
            case AST_VARIABLE_DECLARATION: {
                const { value } = statement.identifier
                content += `AST_VARIABLE_DECLARATION (variable=${value})`
                console.log(content)
                if (statement.initializer) {
                    this.printStatement(statement.initializer, indent + 2)
                }
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

    // Statement ->
    // Binary Expression ',' |
    // Variable Declaration ',' |
    // ','
    parseStatement() {
        const token = this.peekToken()
        if (token.type === TOKEN_COMMA) {
            this.eatToken(TOKEN_COMMA)
        } else if (this.isKeyword(token.type)) {
            switch (token.type) {
                case TOKEN_VAR:
                    return this.parseVariableDeclaration()
                default:
                    throw ''
            }
        }
        return this.parseExpression()
    }

    parseVariableDeclaration() {
        this.eatToken(TOKEN_VAR)
        const identifier = this.eatToken(TOKEN_IDENTIFIER),
            forwardToken = this.peekToken()
        let initializer = null
        if (forwardToken.type === TOKEN_ASSIGN) {
            this.eatToken(TOKEN_ASSIGN)
            initializer = this.parseExpression()
        }

        const variableDecl = this.makeNode(AST_VARIABLE_DECLARATION, { identifier, initializer })

        return variableDecl
    }

    // 解析表达式
    parseExpression(precedence = 0) {
        return this.parseBinaryExpression(precedence)
    }

    // Primary expression ->
    // '(' expression ')' |
    // Function Call |
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
            const { column, line } = token
            return this.makeNode(AST_LITERAL, { operand: value, flags, column, line })
        } else if (type === TOKEN_IDENTIFIER) {
            this.eatToken(TOKEN_IDENTIFIER)
            const forwardToken = this.peekToken()
            const { value, column, line } = token

            if (forwardToken.type === TOKEN_LEFT_PAREN) {
                return this.parseFunctionCall(token)
            }

            return this.makeNode(AST_IDENTIFIER, { value, column, line })
        }
        this.throwError(`Expect a primary expression, but got ${tokenToString(token)}`, token)
    }

    // Binary Expression ->
    // Unary-Expression |
    // Binary-Expression OPERATOR Binary-Expression
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

            leftExpr = this.makeNode(AST_BINARY_EXPRESSION, { lhs: leftExpr, operator: opToken, rhs: rightExpr })

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

    // Unary-Expression ->
    // Primary-Expression |
    // UNARY-OPERATOR Unary-Expression
    parseUnaryExpression() {
        const token = this.peekToken()
        if (token.type !== TOKEN_MINUS) {
            return this.parsePrimaryExpression()
        }
        const operator = this.nextToken()
        const expr = this.parseUnaryExpression()

        return this.makeNode(AST_UNARY_EXPRESSION, { operator, expr })
    }

    // Function-Call ->
    // IDENTIFIER '(' Function-Arguments? ')'
    // Function-Arguments ->
    // Expression (',' Expression)*
    parseFunctionCall(identifier) {
        this.eatToken(TOKEN_LEFT_PAREN)
        const args = []
        let forwardToken = this.peekToken(),
            isFirstArgument = true
        while (forwardToken.type !== TOKEN_RIGHT_PAREN) {
            if (!isFirstArgument) {
                this.eatToken(TOKEN_COMMA)
            }
            const arg = this.parseExpression()
            forwardToken = this.peekToken()
            isFirstArgument = false
            args.push(arg)
        }
        this.eatToken(TOKEN_RIGHT_PAREN)

        const functionCall = this.makeNode(AST_FUNCTION_CALL, { identifier, arguments: args })

        return functionCall
    }

    getPrecedence(operator) {
        if (!(operator in PRECEDENCE_TABLE)) {
            return -1
        }
        return PRECEDENCE_TABLE[operator]
    }
}

const runTest = filepath => {
    const parser = new Parser(filepath)
    const content = fs.readFileSync(filepath, { encoding: 'utf-8' })
    const exprs = parser.parse(content)
    const matches = content.matchAll(/expect:\s*(-?\d+)/g)
    const expects = []
    for (const match of matches) {
        expects.push(parseInt(match[1]))
    }
    for (let i = 0; i < exprs.length; i++) {
        const value = parser.evaluate(exprs[i], true)
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
    .option('-p, --print-only', 'Print expression only, not evaluate it.')
    .version('0.0.1')
    .action(file => {
        const options = program.opts()
        const parser = new Parser(file)
        const content = fs.readFileSync(file, { encoding: 'utf-8' })
        const exprs = parser.parse(content)
        for (const expr of exprs) {
            if (options.printOnly) {
                parser.printStatement(expr)
            } else {
                console.log(`Result is ${parser.evaluate(expr, true)}`)
            }
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
        const parser = new Parser('./temp')
        interface.on('line', input => {
            try {
                const exprs = parser.parse(input)
                for (const expr of exprs) {
                    console.log(parser.evaluate(expr, true))
                }
            } catch (e) {}
        })
    })

program.parse(process.argv)
