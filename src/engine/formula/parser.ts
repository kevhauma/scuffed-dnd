/**
 * Formula Parser
 *
 * Tokenizes and parses formula strings into Abstract Syntax Trees (AST).
 *
 * Grammar:
 *   expression  := term ((PLUS | MINUS) term)*
 *   term        := factor ((MULTIPLY | DIVIDE) factor)*
 *   factor      := PLUS factor | MINUS factor | NUMBER | call | VARIABLE
 *                | LPAREN expression RPAREN
 *   call        := IDENTIFIER LPAREN (expression (COMMA expression)*)? RPAREN
 *
 * An identifier directly followed by `(` always parses as a function call; its name is kept
 * exactly as written and checked case-sensitively against the closed library in
 * `functions.ts` — `round`, `roundup`, `rounddown`, `floor`, `ceil`, `min`, `max`, `clamp`,
 * `abs` (lowercase, reserved). Unknown names and wrong arity are validation errors, not parse
 * errors. Any other identifier is a variable reference, normalized to uppercase.
 *
 * **Validates: Requirements 16.1, 16.2, 16.3; Concepts 01, 02; spec §5.3**
 */

import type { FormulaAST } from '../../types/formula';

/**
 * Token types for lexical analysis
 */
type TokenType =
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'PLUS'
  | 'MINUS'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

/**
 * Token representation
 */
interface Token {
  type: TokenType;
  value: string | number;
  position: number;
}

/**
 * Tokenizer class - converts formula string into tokens
 */
class Tokenizer {
  private input: string;
  private position: number;
  private currentChar: string | null;

  constructor(input: string) {
    this.input = input.trim();
    this.position = 0;
    this.currentChar = this.input.length > 0 ? this.input[0] : null;
  }

  /**
   * Advance to next character
   */
  private advance(): void {
    this.position++;
    this.currentChar = this.position < this.input.length ? this.input[this.position] : null;
  }

  /**
   * Skip whitespace characters
   */
  private skipWhitespace(): void {
    while (this.currentChar !== null && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  /**
   * Parse a number token
   */
  private parseNumber(): Token {
    const startPos = this.position;
    let numStr = '';

    while (this.currentChar !== null && /[0-9.]/.test(this.currentChar)) {
      numStr += this.currentChar;
      this.advance();
    }

    return {
      type: 'NUMBER',
      value: parseFloat(numStr),
      position: startPos,
    };
  }

  /**
   * Parse an identifier token (variable code or function name)
   *
   * Case is preserved here — the parser uppercases variable references but matches
   * function names case-sensitively.
   */
  private parseIdentifier(): Token {
    const startPos = this.position;
    let idStr = '';

    while (this.currentChar !== null && /[A-Za-z]/.test(this.currentChar)) {
      idStr += this.currentChar;
      this.advance();
    }

    return {
      type: 'IDENTIFIER',
      value: idStr,
      position: startPos,
    };
  }

  /**
   * Get next token from input
   */
  public getNextToken(): Token {
    while (this.currentChar !== null) {
      // Skip whitespace
      if (/\s/.test(this.currentChar)) {
        this.skipWhitespace();
        continue;
      }

      // Numbers
      if (/[0-9]/.test(this.currentChar)) {
        return this.parseNumber();
      }

      // Identifiers (letters) — variable codes or function names
      if (/[A-Za-z]/.test(this.currentChar)) {
        return this.parseIdentifier();
      }

      // Operators and parentheses
      const char = this.currentChar;
      const pos = this.position;
      this.advance();

      switch (char) {
        case '+':
          return { type: 'PLUS', value: '+', position: pos };
        case '-':
          return { type: 'MINUS', value: '-', position: pos };
        case '*':
          return { type: 'MULTIPLY', value: '*', position: pos };
        case '/':
          return { type: 'DIVIDE', value: '/', position: pos };
        case '(':
          return { type: 'LPAREN', value: '(', position: pos };
        case ')':
          return { type: 'RPAREN', value: ')', position: pos };
        case ',':
          return { type: 'COMMA', value: ',', position: pos };
        default:
          throw new Error(`Unexpected character '${char}' at position ${pos}`);
      }
    }

    return { type: 'EOF', value: '', position: this.position };
  }
}

/**
 * Parser class - converts tokens into AST (grammar in the module JSDoc above)
 */
export class FormulaParser {
  private tokenizer: Tokenizer;
  private currentToken: Token;

  constructor(input: string) {
    this.tokenizer = new Tokenizer(input);
    this.currentToken = this.tokenizer.getNextToken();
  }

  /**
   * Consume current token and advance to next
   */
  private eat(tokenType: TokenType): void {
    if (this.currentToken.type === tokenType) {
      this.currentToken = this.tokenizer.getNextToken();
    } else {
      throw new Error(
        `Expected token type ${tokenType} but got ${this.currentToken.type} at position ${this.currentToken.position}`
      );
    }
  }

  /**
   * Parse factor: NUMBER | call | VARIABLE | LPAREN expression RPAREN | unary operator
   */
  private factor(): FormulaAST {
    const token = this.currentToken;

    // Unary plus
    if (token.type === 'PLUS') {
      this.eat('PLUS');
      return this.factor(); // Just return the factor, unary plus has no effect
    }

    // Unary minus (negation)
    if (token.type === 'MINUS') {
      this.eat('MINUS');
      return {
        type: 'unary_op',
        operator: 'negate',
        operand: this.factor(),
      };
    }

    // Number literal
    if (token.type === 'NUMBER') {
      this.eat('NUMBER');
      return {
        type: 'number',
        value: token.value as number,
      };
    }

    // Function call (identifier directly followed by `(`) or variable reference
    if (token.type === 'IDENTIFIER') {
      this.eat('IDENTIFIER');

      if (this.currentToken.type === 'LPAREN') {
        return this.callArguments(token.value as string);
      }

      return {
        type: 'variable',
        value: (token.value as string).toUpperCase(), // Normalize to uppercase
      };
    }

    // Parenthesized expression
    if (token.type === 'LPAREN') {
      this.eat('LPAREN');
      const node = this.expression();
      this.eat('RPAREN');
      return node;
    }

    throw new Error(`Unexpected token ${token.type} at position ${token.position}`);
  }

  /**
   * Parse call arguments: LPAREN (expression (COMMA expression)*)? RPAREN
   *
   * The name is kept as written — arity and library membership are validation
   * concerns, not parse errors.
   */
  private callArguments(name: string): FormulaAST {
    this.eat('LPAREN');
    const args: FormulaAST[] = [];

    if (this.currentToken.type !== 'RPAREN') {
      args.push(this.expression());
      while (this.currentToken.type === 'COMMA') {
        this.eat('COMMA');
        args.push(this.expression());
      }
    }

    this.eat('RPAREN');
    return {
      type: 'function_call',
      name,
      args,
    };
  }

  /**
   * Parse term: factor ((MULTIPLY | DIVIDE) factor)*
   */
  private term(): FormulaAST {
    let node = this.factor();

    while (this.currentToken.type === 'MULTIPLY' || this.currentToken.type === 'DIVIDE') {
      const token = this.currentToken;

      if (token.type === 'MULTIPLY') {
        this.eat('MULTIPLY');
        node = {
          type: 'binary_op',
          operator: '*',
          left: node,
          right: this.factor(),
        };
      } else if (token.type === 'DIVIDE') {
        this.eat('DIVIDE');
        node = {
          type: 'binary_op',
          operator: '/',
          left: node,
          right: this.factor(),
        };
      }
    }

    return node;
  }

  /**
   * Parse expression: term ((PLUS | MINUS) term)*
   */
  private expression(): FormulaAST {
    let node = this.term();

    while (this.currentToken.type === 'PLUS' || this.currentToken.type === 'MINUS') {
      const token = this.currentToken;

      if (token.type === 'PLUS') {
        this.eat('PLUS');
        node = {
          type: 'binary_op',
          operator: '+',
          left: node,
          right: this.term(),
        };
      } else if (token.type === 'MINUS') {
        this.eat('MINUS');
        node = {
          type: 'binary_op',
          operator: '-',
          left: node,
          right: this.term(),
        };
      }
    }

    return node;
  }

  /**
   * Parse the formula and return AST
   */
  public parse(): FormulaAST {
    const ast = this.expression();

    // Ensure we've consumed all tokens
    if (this.currentToken.type !== 'EOF') {
      throw new Error(
        `Unexpected token ${this.currentToken.type} at position ${this.currentToken.position}`
      );
    }

    return ast;
  }
}

/**
 * Parse a formula string into an AST
 *
 * @param formula - Formula string to parse
 * @returns AST representation of the formula
 * @throws Error if formula has syntax errors
 */
export function parseFormula(formula: string): FormulaAST {
  const parser = new FormulaParser(formula);
  return parser.parse();
}
