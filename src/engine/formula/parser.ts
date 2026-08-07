/**
 * Formula Parser
 *
 * Tokenizes and parses formula strings into Abstract Syntax Trees (AST).
 *
 * Grammar:
 *   expression  := term ((PLUS | MINUS) term)*
 *   term        := factor ((MULTIPLY | DIVIDE) factor)*
 *   factor      := PLUS factor | MINUS factor | NUMBER | ref | LPAREN expression RPAREN
 *   ref         := IDENTIFIER LPAREN args RPAREN                        (function call)
 *                | IDENTIFIER DOT member (DOT IDENTIFIER)? LPAREN args RPAREN
 *                                                                      (namespaced call, e.g. curve.cr(x),
 *                                                                       curve.point_buy.main_type(9))
 *                | IDENTIFIER DOT member (DOT IDENTIFIER)?              (namespaced reference)
 *                | member                                               (bare variable — deprecated when an IDENTIFIER)
 *   member      := IDENTIFIER | REF_ID
 *   args        := (expression (COMMA expression)*)?
 *   IDENTIFIER  := [A-Za-z][A-Za-z0-9_]*
 *   REF_ID      := '[' [^\]]+ ']'
 *
 * An identifier directly followed by `(` always parses as a function call; its name is kept
 * exactly as written and checked case-sensitively against the closed library in
 * `functions.ts` — `round`, `roundup`, `rounddown`, `floor`, `ceil`, `min`, `max`, `clamp`,
 * `abs` (lowercase, reserved). Unknown names and wrong arity are validation errors, not parse
 * errors.
 *
 * Dotted references (`stats.speed`, `skills.healing.level`, `const.bonus_divider`) keep every
 * segment exactly as written — namespaces are lowercase and resolved case-sensitively at
 * evaluation time. A namespaced call (`curve.cr(x)`) evaluates through the namespace's resolver;
 * a third segment before the parentheses selects which output it produces, which is how a
 * multi-column curve is read (`curve.point_buy.main_type(9)` — TICKET-CRV-01).
 * A bare identifier is a legacy variable reference, normalized to uppercase —
 * **deprecated**, kept until TICKET-STAT-01 removes flat codes.
 *
 * A bracketed segment (`[b1f0…]`, `stats.[b1f0…]`) is an **id reference** — the rename-safe form a
 * formula is persisted in (TICKET-REF-01). Brackets accept any id text, so a `crypto.randomUUID()`
 * survives the tokenizer's arithmetic characters, and case is preserved rather than uppercased
 * because ids are matched exactly. Users never type this form: `engine/formula/references.ts`
 * translates between it and the display form at the storage boundary.
 *
 * **Validates: Requirements 16.1, 16.2, 16.3; Concepts 00 §5, 01, 02; spec §5.1, §5.3**
 */

import type { FormulaAST } from '../../types/formula';

/**
 * Token types for lexical analysis
 */
type TokenType =
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'REF_ID'
  | 'PLUS'
  | 'MINUS'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'DOT'
  | 'EOF';

/**
 * Token representation
 *
 * `position` and `end` are offsets into the formula source, so a caller holding the tokens can
 * splice a token's text without re-deriving where it sat — that is how `references.ts` rewrites
 * reference tokens while leaving the User's spacing untouched.
 */
export interface FormulaToken {
  type: TokenType;
  value: string | number;
  position: number;
  /** Offset one past the token's last character */
  end: number;
}

type Token = FormulaToken;

/**
 * Tokenizer class - converts formula string into tokens
 */
class Tokenizer {
  private input: string;
  private position: number;
  private currentChar: string | null;

  constructor(input: string) {
    // Not trimmed: `skipWhitespace` already handles surrounding blanks, and keeping the raw string
    // makes every token position an offset into the source the caller passed in.
    this.input = input;
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
      end: this.position,
    };
  }

  /**
   * Parse a bracketed id reference token — `[` … `]` with the id kept verbatim
   *
   * Ids are opaque (a `crypto.randomUUID()` contains hyphens, which are arithmetic elsewhere), so
   * everything up to the closing bracket is taken as-is. An empty or unterminated bracket is a
   * syntax error rather than a silently empty reference.
   */
  private parseReferenceId(): Token {
    const startPos = this.position;
    this.advance(); // consume '['

    let idStr = '';
    while (this.currentChar !== null && this.currentChar !== ']') {
      idStr += this.currentChar;
      this.advance();
    }

    if (this.currentChar === null) {
      throw new Error(`Unterminated id reference at position ${startPos}`);
    }
    this.advance(); // consume ']'

    if (idStr.length === 0) {
      throw new Error(`Empty id reference at position ${startPos}`);
    }

    return {
      type: 'REF_ID',
      value: idStr,
      position: startPos,
      end: this.position,
    };
  }

  /**
   * Parse an identifier token — a variable code, a function name, or one segment of a
   * dotted reference (`[A-Za-z][A-Za-z0-9_]*`, so `bonus_divider` and `STR2` are single
   * identifiers).
   *
   * Case is preserved here — the parser uppercases bare variable references but matches
   * function names and namespace segments case-sensitively.
   */
  private parseIdentifier(): Token {
    const startPos = this.position;
    let idStr = '';

    while (this.currentChar !== null && /[A-Za-z0-9_]/.test(this.currentChar)) {
      idStr += this.currentChar;
      this.advance();
    }

    return {
      type: 'IDENTIFIER',
      value: idStr,
      position: startPos,
      end: this.position,
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

      // Bracketed id reference — the persisted, rename-safe form (TICKET-REF-01)
      if (this.currentChar === '[') {
        return this.parseReferenceId();
      }

      // Operators and parentheses
      const char = this.currentChar;
      const pos = this.position;
      this.advance();
      const end = this.position;

      switch (char) {
        case '+':
          return { type: 'PLUS', value: '+', position: pos, end };
        case '-':
          return { type: 'MINUS', value: '-', position: pos, end };
        case '*':
          return { type: 'MULTIPLY', value: '*', position: pos, end };
        case '/':
          return { type: 'DIVIDE', value: '/', position: pos, end };
        case '(':
          return { type: 'LPAREN', value: '(', position: pos, end };
        case ')':
          return { type: 'RPAREN', value: ')', position: pos, end };
        case ',':
          return { type: 'COMMA', value: ',', position: pos, end };
        case '.':
          return { type: 'DOT', value: '.', position: pos, end };
        default:
          throw new Error(`Unexpected character '${char}' at position ${pos}`);
      }
    }

    return { type: 'EOF', value: '', position: this.position, end: this.position };
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
   * Parse factor: NUMBER | ref | LPAREN expression RPAREN | unary operator
   *
   * `ref` covers all four identifier-led forms — function call, namespaced call, namespaced
   * reference, and bare variable — see the `ref` production in the module grammar.
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

    // Function call, namespaced reference/call, or bare variable reference
    if (token.type === 'IDENTIFIER') {
      this.eat('IDENTIFIER');

      if (this.currentToken.type === 'LPAREN') {
        return {
          type: 'function_call',
          name: token.value as string,
          args: this.callArguments(),
        };
      }

      if (this.currentToken.type === 'DOT') {
        return this.namespacedReference(token.value as string);
      }

      return {
        type: 'variable',
        value: (token.value as string).toUpperCase(), // Normalize to uppercase
      };
    }

    // Bare id reference — the persisted form of a legacy bare code; kept case-exact
    if (token.type === 'REF_ID') {
      this.eat('REF_ID');
      return {
        type: 'variable',
        value: token.value as string,
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
   * Parse a dotted reference after its namespace segment:
   * DOT member (LPAREN args RPAREN | DOT IDENTIFIER (LPAREN args RPAREN)?)?
   *
   * Two segments make a namespaced reference (`stats.speed`), an argument list makes a
   * namespaced call (`curve.cr(x)`), and a third segment is a property — of a reference
   * (`skills.healing.level`) or of a call, where it selects which output the call produces
   * (`curve.point_buy.main_type(9)` reads the `main_type` column). Segments are kept exactly
   * as written.
   *
   * The member may be a bracketed id (`stats.[b1f0…]`, `curve.[7c22…](x)`) — the persisted form
   * of the same reference (TICKET-REF-01).
   */
  private namespacedReference(namespace: string): FormulaAST {
    this.eat('DOT');
    const memberToken = this.currentToken;
    this.eat(memberToken.type === 'REF_ID' ? 'REF_ID' : 'IDENTIFIER');
    const member = memberToken.value as string;

    if (this.currentToken.type === 'LPAREN') {
      return {
        type: 'namespaced_call',
        namespace,
        member,
        args: this.callArguments(),
      };
    }

    if (this.currentToken.type === 'DOT') {
      this.eat('DOT');
      const propertyToken = this.currentToken;
      this.eat('IDENTIFIER');
      const property = propertyToken.value as string;

      // Widened deliberately: control-flow analysis still has `this.currentToken` narrowed to the
      // DOT that opened this branch, and the two `eat`s above are what moved it on.
      const afterProperty: Token = this.currentToken;
      if (afterProperty.type === 'LPAREN') {
        return {
          type: 'namespaced_call',
          namespace,
          member,
          property,
          args: this.callArguments(),
        };
      }

      return {
        type: 'namespaced_ref',
        namespace,
        member,
        property,
      };
    }

    return {
      type: 'namespaced_ref',
      namespace,
      member,
    };
  }

  /**
   * Parse call arguments: LPAREN (expression (COMMA expression)*)? RPAREN
   *
   * Names are kept as written — arity and library membership are validation
   * concerns, not parse errors.
   */
  private callArguments(): FormulaAST[] {
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
    return args;
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

/**
 * Tokenize a formula string without parsing it
 *
 * The lexical half on its own, for callers that rewrite reference tokens in place rather than
 * interpreting the expression — `references.ts` is the one such caller. Working from tokens is
 * what keeps a rewritten formula byte-identical outside the tokens it replaced, so the User's
 * spacing and parentheses survive a rename.
 *
 * @param formula - Formula source text
 * @returns Every token in source order, ending with `EOF`
 * @throws Error on a character the tokenizer does not recognize
 */
export function tokenizeFormula(formula: string): FormulaToken[] {
  const tokenizer = new Tokenizer(formula);
  const tokens: FormulaToken[] = [];

  let token = tokenizer.getNextToken();
  while (token.type !== 'EOF') {
    tokens.push(token);
    token = tokenizer.getNextToken();
  }
  tokens.push(token);

  return tokens;
}
