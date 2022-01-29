/*
    TODO:
        全部完成
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
        this.notes = []

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
    constructor(reporter) {
        this.variables = new Map()
        this.reporter = reporter
    }

    resetState() {
        this.variables = new Map()
    }

    checkFlag(flags, flag) {
        return (flags & flag) === flag
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

    // 解释语句
    // statement 语句，可以是表达式或者变量声明
    // evalValue 是否只返回具体值，还是返回解释后的节点细节内容
    interpret(statement, evalValue = false) {
        switch (statement.type) {
            case AST_LITERAL:
                return this.interpretLiteral(statement, evalValue)
            case AST_BINARY_EXPRESSION:
                return this.interpretBinaryExpression(statement, evalValue)
            case AST_UNARY_EXPRESSION:
                return this.interpretUnaryExpression(statement, evalValue)
            case AST_IDENTIFIER:
                return this.interpretIdentifier(statement, evalValue)
            case AST_FUNCTION_CALL:
                return this.interpretFunctionCall(statement, evalValue)
            case AST_VARIABLE_DECLARATION:
                this.interpretVariableDeclaration(statement)
                break
            default:
                throw 'Unhandled statement type!'
        }
    }

    // 解释字面量节点
    // literal
    // evalValue
    interpretLiteral(literal, evalValue) {
        if (evalValue) {
            return literal.operand
        }

        return literal
    }

    // 解释二元表达式，需要考虑变量类型提升
    // binaryExpr 二元表达式节点
    // evalValue 是否只求值，不返回具体细节
    interpretBinaryExpression(binaryExpr, evalValue) {
        // 获取左表达式和右表达式
        const { lhs, rhs, operator } = binaryExpr
        // 获取当前表达式的起始行号和列号
        const { column, line } = binaryExpr
        // 获取左表达式的操作数和标志
        const { operand: lhsOperand, flags: lhsFlags } = this.interpret(lhs)
        // 获取右表达式的操作数和标志
        const { operand: rhsOperand, flags: rhsFlags } = this.interpret(rhs)
        // 检查左右表达式的标志是否都是整数，如果有一个不是，则需要类型提升
        const isBothInteger = this.checkFlag(lhsFlags, LITERAL_FLAG_INTEGER) && this.checkFlag(rhsFlags, LITERAL_FLAG_INTEGER)
        let operand

        switch (operator.type) {
            case TOKEN_PLUS:
                operand = lhsOperand + rhsOperand
                break
            case TOKEN_MINUS:
                operand = lhsOperand - rhsOperand
                break
            case TOKEN_ASTERISK:
                operand = lhsOperand * rhsOperand
                break
            case TOKEN_SLASH:
                operand = lhsOperand / rhsOperand
                if (isBothInteger) {
                    // 如果是两个整数相除，结果应该也是整数
                    // 取整采用舍去法
                    operand >>>= 0
                }
                break
            case TOKEN_PERCENT:
                if (!isBothInteger) {
                    // 运行时检查
                    // 解释器中规定模运算只能在整数与整数之间进行
                    // 如果左表达式或者右表达式有一个不是整数
                    // 则应该报错
                    const lhsType = literalFlagsToString(lhsFlags),
                        rhsType = literalFlagsToString(rhsFlags)
                    this.throwNote(`The left-hand side value type is ${lhsType}`, lhs)
                    this.throwNote(`The right-hand side value type is ${rhsType}`, rhs)
                    this.throwError('Modulo operation can only apply on integer value!', operator)
                }
                operand = lhsOperand % rhsOperand
                break
            default:
                // 理论上还有逻辑算符和位运算符，对于这些未实现的运算符
                // 和其他非法算符，应给出错误提示
                this.throwError(`Invalid binary operator: ${tokenToString(operator)}`, operator)
        }

        if (evalValue) {
            return operand
        }

        let flags = LITERAL_FLAG_DOUBLE
        if (isBothInteger) {
            flags = LITERAL_FLAG_INTEGER
        }

        return { operand, flags, column, line }
    }

    interpretUnaryExpression(unaryExpr, evalValue) {
        const { operator, expr } = unaryExpr
        let interpretedExpr = this.interpret(expr)
        let { operand, flags } = interpretedExpr
        switch (operator.type) {
            case TOKEN_MINUS:
                operand *= -1
                break
            default:
                this.throwError(`Invalid unary operator: ${tokenToString(operator)}`, operator)
        }

        if (evalValue) {
            return operand
        }

        return { operand, flags }
    }

    interpretFunctionCall(funcCall, evalValue) {
        const { identifier, arguments: args } = funcCall
        const { value: fnName } = identifier
        const calledFn = BUILTIN_FNS[fnName]
        if (!calledFn) {
            this.throwError(`Runtime error: Undefined function: ${fnName}`, identifier)
        }
        const params = []
        for (const arg of args) {
            const param = this.interpret(arg, true)
            params.push(param)
        }
        const operand = calledFn.apply(this, params)

        if (evalValue) {
            return operand
        }

        const flags = LITERAL_FLAG_DOUBLE
        return { operand, flags }
    }

    interpretVariableDeclaration(varDecl) {
        const { identifier, initializer } = varDecl
        const { value: varName } = identifier
        let operand = null, flags = 0

        if (initializer) {
            operand = this.interpret(initializer, true)
            flags = initializer.flags
        }
        this.variables.set(varName, { operand, flags })
    }

    interpretIdentifier(identifier, evalValue) {
        const { value } = identifier
        if (!this.variables.has(value)) {
            this.throwError(`Runtime error: Undefined variable: ${value}`, identifier)
        }
        const result = this.variables.get(value)
        if (!result.operand) {
            this.throwError(`Runtime error: Uninitialized variable: ${value}`, identifier)
        }

        if (evalValue) {
            return result.operand
        }

        return result
    }
}

// 语法树打印器
class Printer {
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
}

// 解析器
class Parser {
    constructor(reporter) {
        this.source = null
        this.reporter = reporter
        this.resetState()
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

    // 构造一个词元，结构如下
    // type: 词元的类型，采用TOKEN_XXX的形式表示
    // value: 词元可能附带的值，主要针对字面量和标识符类型的词元
    // column: 词元的起始列号
    // line: 词元的起始行号
    makeToken(type, value = null) {
        // 存储词元的类型，具体数值
        // 词元的起始行号和列号
        return { type, value, column: this.curColumn, line: this.curLine }
    }

    // 获取下一个词元
    // 当解析到文件末尾(EOF)时，将会返回类型为TOKEN_EOF的词元
    // 否则将根据词法解析规则返回相应类型的词元
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

    // 本解析器将会忽略空格、换行符、制表符，以上为无用字符
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

    // 本解析器规定#为行注释开始标识，且只支持行级注释
    // 需要跳过行级注释
    skipComment() {
        let char = this.source.charAt(this.curPointer)
        while (char !== '\n' && this.curPointer < this.source.length) {
            this.curPointer++
            char = this.source.charAt(this.curPointer)
        }
    }

    // 检测给定的字符是否满足数字字面量的词法匹配规则
    isNumberLiteral(character) {
        return /^[0-9.]$/.test(character)
    }

    // 检测给定的字符是否满足运算符的词法匹配规则
    isOperator(character) {
        return /^[+\-*/%]$/.test(character)
    }

    // 检测给定的字符是否满足标识符的词法匹配规则
    // 对于标识符来说，首字符和接下来的字符匹配规则有所不同
    // 所以需要使用isStart参数来分别判断
    isIdentifier(character, isStart = false) {
        if (isStart) {
            return /^[a-zA-Z_]$/.test(character)            
        }

        return /^[a-zA-Z0-9_]$/.test(character)
    }

    // 判断给定的词元类型是否属于关键字
    isKeyword(type) {
        return type >= TOKEN_VAR && type < TOKEN_LITERAL
    }

    // 解析数字字面量，支持整数和浮点数的解析
    // 返回的词元结构如下
    // value: 表示数字字面量的值，一定是0或者正数
    // flags: 当前字面量携带的标识，有以下几种
    // LITERAL_FLAG_INTEGER 表示该字面量是整型字面量
    // LITERAL_FLAG_DOUBLE 表示该字面量是浮点字面量
    // column: 当前字面量的起始列号
    // line: 当前字面量的起始行号
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

    // 解析运算符
    // 返回的词元结构如下
    // column: 算符词元的所在列号
    // line: 算符词元的所在行号
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

    // 解析标识符
    // 关键字是标识符的一种特殊形式，因此单独为关键字添加了独立的词元类型
    // 对于普通的标识符，类型是TOKEN_IDENTIFIER
    // 对于关键字，则会返回对应的词元类型
    // 如果是普通标识符，词元结构如下
    // value: 标识符的文本内容
    // 如果是关键字，则没有该项，以下两项为公共属性
    // column: 词元的起始列号
    // line: 词元的起始行号
    nextIdentifier() {
        let count = 1,
            char = this.source.charAt(this.curPointer + 1)

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

    // 匹配关键字，并修改给定词元的词元类型
    // 初步解析得到的还是标识符，需要查询内置的关键字表
    // 如果是关键字，则强制修改类型
    matchKeyword(token) {
        const name = token.value
        const mappedType = KEYWORD_MAPPING[name]
        if (mappedType) {
            token.type = mappedType
        }
    }

    // 断言下一个词元的类型
    // 如果词元的类型与断言类型不符，则报错
    // 如果相符，则消耗该词元并作为返回值返回
    eatToken(type) {
        const token = this.nextToken()
        if (token.type !== type) {
            const unexpectedToken = tokenToString(token),
                expectedToken = tokenToString(type, true)
            this.throwError(`Unexpected token: ${unexpectedToken}, expect token: ${expectedToken}`)
        }
        return token
    }

    // 查看往后的第X个词元
    // 仅仅是向后看词元，并不消耗词元
    // peekAmount: 向后看的词元个数，即查看往后的第peekAmount个词元
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

    hasFlag(flags, flag) {
        return flags & flag === flag
    }

    // 构造一个抽象语法树节点
    // type: 节点的类型，以AST_*开头的常量
    // body: 节点附带的其他信息，会被解构然后合并到节点对象
    makeNode(type, body) {
        const node = { type, ...body }

        return node
    }

    // 解析语句
    // 语句可以是表达式，也可以是变量声明
    // 每个语句必须以逗号结尾，表示一个语句的结束
    // 纯逗号会被解析器忽略，消耗后继续解析直到得到有效的语句
    // Statement ->
    // Binary Expression ',' |
    // Variable Declaration ',' |
    // ','
    parseStatement() {
        const token = this.peekToken()
        if (token.type === TOKEN_COMMA) {
            this.eatToken(TOKEN_COMMA)
            return this.parseStatement()
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

    // 解析变量声明
    // 变量声明语句至少由关键字'var'和一个标识符词元组成
    // 其中标识符不能和内置的关键字以及数学函数名重复，否则属于语义错误
    // 可以为变量添加初始化赋值表达式，若该变量没有被赋值，则被引用时会产生运行时错误
    // 变量声明语句的节点结构如下
    // identifier: 标识符节点
    // initializer: 赋值表达式，可有可无，若没有则为null
    // 变量声明的产生式如下
    // Variable-Declaration ->
    // 'var' IDENTIFIER ['=' Expression]
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

    // 解析主表达式
    // 主表达式是表达式中优先级最高的表达式
    // 主表达式可以是字面量、标识符、带括号的表达式或者函数调用
    // 如果主表达式是字面量，则节点结构如下
    // operand: 字面量的具体值
    // flags: 字面量具有的标识
    // column: 字面量在源码中的起始列号
    // line: 字面量在源码中的起始行号
    // 如果主表达式是标识符，则节点结构如下
    // value: 标识符的具体内容
    // column: 标识符在源码中的起始列号
    // line: 标识符在源码中的起始行号
    // 主表达式的产生式如下
    // Primary expression ->
    // '(' expression ')' |
    // Function Call |
    // LITERAL |
    // IDENTIFIER
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

    // 解析二元表达式
    // 二元表达式是表达式语句中最基本的，对于每个二元运算符都存在一个优先级
    // 运算符优先级越高，则其越先被计算，在抽象语法树中则表现为深度为大的节点
    // 二元表达式的节点结构如下
    // lhs: 左侧表达式，可以是字面量、标识符、表达式
    // operator: 运算符词元
    // rhs: 右侧表达式，内容和lhs相同
    // 二元表达式的产生式如下
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
        if (curPrecedence === -1) {
            this.throwError(`Invalid binary operator: ${tokenToString(token)}`, token)
        }

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

    // 解析一元表达式
    // 一元表达式的仅次于主表达式的表达式类型
    // 一元表达式优先于二元表达式，需要先执行
    // 一元表达式的节点结构如下
    // operator: 运算符词元
    // expr: 表达式
    // 一元表达式的产生式如下
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

    // 解析函数调用
    // 函数调用属于后缀表达式的一种，由标识符和若干参数组成
    // 函数调用的节点结构如下
    // identifier: 标识符，用于调用指定的函数
    // arguments: 由表达式组成的数组，如果没有实参，则为空
    // 函数调用的产生式如下
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

    // 根据给定的运算符，给定其对应的优先级
    // 如果是二元表达式不支持的算符，则返回-1
    getPrecedence(operator) {
        if (!(operator in PRECEDENCE_TABLE)) {
            return -1
        }
        return PRECEDENCE_TABLE[operator]
    }
}

const runTest = filepath => {
    const reporter = new Reporter(filepath)
    const parser = new Parser(reporter),
        interpreter = new Interpreter(reporter)
    const content = fs.readFileSync(filepath, { encoding: 'utf-8' })
    const statements = parser.parse(content)
    const matches = content.matchAll(/expect:\s*(-?\d+)/g)
    const expects = []
    let count = 0
    for (const match of matches) {
        expects.push(parseInt(match[1]))
    }
    for (const statement of statements) {
        const result = interpreter.interpret(statement, true)
        if (statement.type !== AST_VARIABLE_DECLARATION) {
            if (result !== expects[count]) {
                console.log(`Test failed, Unexpected result: ${value}, expect: ${expects[i]}`)
                return false
            }
            count++
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
        const reporter = new Reporter(file)
        const parser = new Parser(reporter)
        const content = fs.readFileSync(file, { encoding: 'utf-8' })
        const statements = parser.parse(content)
        const executor = options.printOnly ? new Printer() : new Interpreter(reporter)
        for (const statement of statements) {
            if (executor instanceof Printer) {
                executor.printStatement(statement)
            } else {
                const result = executor.interpret(statement, true)
                console.log(`Result is ${result}`)
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
        const reporter = new Reporter('./temp')
        const parser = new Parser(reporter)
        const interpreter = new Interpreter(reporter)
        interface.on('line', input => {
            try {
                reporter.loadLineInfo(input)
                const statements = parser.parse(input)
                for (const statement of statements) {
                    const result = interpreter.interpret(statement, true)
                    if (result) {
                        console.log(result)
                    }
                }
            } catch (e) {}
        })
    })

program.parse(process.argv)
