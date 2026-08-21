import { CellCoordinate, addressToCoord } from './excelTypes';

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'CELL'
  | 'RANGE'
  | 'IDENTIFIER' // Function name or identifier
  | 'OPERATOR' // +, -, *, /, ^, &, =, <>, <, <=, >, >=
  | 'LPAREN'
  | 'RPAREN'
  | 'SEMICOLON'
  | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

// AST Nodes
export type ASTNode =
  | NumberNode
  | StringNode
  | BooleanNode
  | CellRefNode
  | RangeNode
  | FunctionCallNode
  | UnaryOpNode
  | BinaryOpNode;

export interface NumberNode {
  type: 'Number';
  value: number;
}

export interface StringNode {
  type: 'String';
  value: string;
}

export interface BooleanNode {
  type: 'Boolean';
  value: boolean;
}

export interface CellRefNode {
  type: 'CellRef';
  address: string;
  coord: CellCoordinate;
}

export interface RangeNode {
  type: 'Range';
  address: string; // e.g. "A1:A5"
  start: CellCoordinate;
  end: CellCoordinate;
}

export interface FunctionCallNode {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
}

export interface UnaryOpNode {
  type: 'UnaryOp';
  operator: '+' | '-';
  argument: ASTNode;
}

export interface BinaryOpNode {
  type: 'BinaryOp';
  operator: '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '<=' | '>' | '>=';
  left: ASTNode;
  right: ASTNode;
}

/**
 * Tokenizer / Lexer for Excel formulas
 */
export class ExcelLexer {
  private input: string;
  private pos: number = 0;
  private len: number;

  constructor(input: string) {
    // Strip leading '=' if present
    this.input = input.startsWith('=') ? input.substring(1) : input;
    this.len = this.input.length;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.len) {
      const ch = this.input[this.pos];

      // Skip whitespace
      if (/\s/.test(ch)) {
        this.pos++;
        continue;
      }

      const startPos = this.pos;

      // Strings in double quotes: "Hello"
      if (ch === '"') {
        tokens.push(this.readString());
        continue;
      }

      // Numbers: 123, 12.34
      if (/[0-9]/.test(ch)) {
        tokens.push(this.readNumber());
        continue;
      }

      // Operators: >=, <=, <>, =, <, >, +, -, *, /, ^, &
      if (ch === '<' || ch === '>') {
        let op = ch;
        this.pos++;
        if (this.pos < this.len && (this.input[this.pos] === '=' || this.input[this.pos] === '>')) {
          op += this.input[this.pos];
          this.pos++;
        }
        tokens.push({ type: 'OPERATOR', value: op, pos: startPos });
        continue;
      }

      if (ch === '=' || ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '&') {
        tokens.push({ type: 'OPERATOR', value: ch, pos: startPos });
        this.pos++;
        continue;
      }

      // Parentheses & Delimiters
      if (ch === '(') {
        tokens.push({ type: 'LPAREN', value: '(', pos: startPos });
        this.pos++;
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: 'RPAREN', value: ')', pos: startPos });
        this.pos++;
        continue;
      }
      if (ch === ';') {
        tokens.push({ type: 'SEMICOLON', value: ';', pos: startPos });
        this.pos++;
        continue;
      }
      if (ch === ',') {
        tokens.push({ type: 'COMMA', value: ',', pos: startPos });
        this.pos++;
        continue;
      }

      // Identifiers, Cell references, Ranges, or Booleans: e.g. A1, A1:B5, SOMME, NB.SI, VRAI
      if (/[A-Za-z_]/.test(ch)) {
        tokens.push(this.readIdentifierOrCellOrRange());
        continue;
      }

      // Unknown character, skip
      this.pos++;
    }

    tokens.push({ type: 'EOF', value: '', pos: this.pos });
    return tokens;
  }

  private readString(): Token {
    const startPos = this.pos;
    this.pos++; // Skip opening quote
    let str = '';
    while (this.pos < this.len) {
      if (this.input[this.pos] === '"') {
        // Check for escaped quote ""
        if (this.pos + 1 < this.len && this.input[this.pos + 1] === '"') {
          str += '"';
          this.pos += 2;
        } else {
          this.pos++; // Skip closing quote
          break;
        }
      } else {
        str += this.input[this.pos];
        this.pos++;
      }
    }
    return { type: 'STRING', value: str, pos: startPos };
  }

  private readNumber(): Token {
    const startPos = this.pos;
    let numStr = '';
    let hasDot = false;

    while (this.pos < this.len) {
      const ch = this.input[this.pos];
      if (/[0-9]/.test(ch)) {
        numStr += ch;
        this.pos++;
      } else if (ch === '.' && !hasDot) {
        hasDot = true;
        numStr += ch;
        this.pos++;
      } else {
        break;
      }
    }
    return { type: 'NUMBER', value: numStr, pos: startPos };
  }

  private readIdentifierOrCellOrRange(): Token {
    const startPos = this.pos;
    let raw = '';

    // Read word including letters, digits, underscore, dot (for NB.SI, SOMME.SI)
    while (this.pos < this.len && /[A-Za-z0-9_.]/.test(this.input[this.pos])) {
      raw += this.input[this.pos];
      this.pos++;
    }

    const upper = raw.toUpperCase();

    // Check if followed by colon ':' for range e.g. A1:B5
    if (this.pos < this.len && this.input[this.pos] === ':') {
      const coord1 = addressToCoord(upper);
      if (coord1 !== null) {
        this.pos++; // skip ':'
        let secondPart = '';
        while (this.pos < this.len && /[A-Za-z0-9]/.test(this.input[this.pos])) {
          secondPart += this.input[this.pos];
          this.pos++;
        }
        const coord2 = addressToCoord(secondPart.toUpperCase());
        if (coord2 !== null) {
          return {
            type: 'RANGE',
            value: `${upper}:${secondPart.toUpperCase()}`,
            pos: startPos
          };
        }
      }
    }

    // Check for boolean
    if (upper === 'VRAI' || upper === 'TRUE' || upper === 'FAUX' || upper === 'FALSE') {
      return { type: 'BOOLEAN', value: upper, pos: startPos };
    }

    // Check if single cell coordinate
    const cellCoord = addressToCoord(upper);
    if (cellCoord !== null) {
      return { type: 'CELL', value: upper, pos: startPos };
    }

    // Otherwise standard function identifier
    return { type: 'IDENTIFIER', value: upper, pos: startPos };
  }
}

/**
 * Recursive Descent Parser for Excel Formulas
 */
export class ExcelParser {
  private tokens: Token[] = [];
  private current: number = 0;

  constructor(formula: string) {
    const lexer = new ExcelLexer(formula);
    this.tokens = lexer.tokenize();
  }

  public parse(): ASTNode {
    const node = this.parseExpression();
    if (!this.isAtEnd()) {
      // If trailing tokens exist
      throw new Error(`Unexpected token at position ${this.peek().pos}: ${this.peek().value}`);
    }
    return node;
  }

  // Precedence level 1: Comparison (=, <>, <, <=, >, >=)
  private parseExpression(): ASTNode {
    let left = this.parseConcat();

    while (this.matchOperator('=', '<>', '<', '<=', '>', '>=')) {
      const op = this.previous().value as any;
      const right = this.parseConcat();
      left = { type: 'BinaryOp', operator: op, left, right };
    }

    return left;
  }

  // Precedence level 2: Concat (&)
  private parseConcat(): ASTNode {
    let left = this.parseAdditive();

    while (this.matchOperator('&')) {
      const op = this.previous().value as any;
      const right = this.parseAdditive();
      left = { type: 'BinaryOp', operator: op, left, right };
    }

    return left;
  }

  // Precedence level 3: Addition & Subtraction (+, -)
  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();

    while (this.matchOperator('+', '-')) {
      const op = this.previous().value as any;
      const right = this.parseMultiplicative();
      left = { type: 'BinaryOp', operator: op, left, right };
    }

    return left;
  }

  // Precedence level 4: Multiplication & Division (*, /)
  private parseMultiplicative(): ASTNode {
    let left = this.parsePower();

    while (this.matchOperator('*', '/')) {
      const op = this.previous().value as any;
      const right = this.parsePower();
      left = { type: 'BinaryOp', operator: op, left, right };
    }

    return left;
  }

  // Precedence level 5: Power (^)
  private parsePower(): ASTNode {
    let left = this.parseUnary();

    while (this.matchOperator('^')) {
      const op = this.previous().value as any;
      const right = this.parseUnary();
      left = { type: 'BinaryOp', operator: op, left, right };
    }

    return left;
  }

  // Precedence level 6: Unary (+, -)
  private parseUnary(): ASTNode {
    if (this.matchOperator('+', '-')) {
      const op = this.previous().value as '+' | '-';
      const arg = this.parseUnary();
      return { type: 'UnaryOp', operator: op, argument: arg };
    }

    return this.parsePrimary();
  }

  // Precedence level 7: Primary (Number, String, Boolean, Cell, Range, Function, (expr))
  private parsePrimary(): ASTNode {
    const token = this.peek();

    if (token.type === 'NUMBER') {
      this.advance();
      return { type: 'Number', value: parseFloat(token.value) };
    }

    if (token.type === 'STRING') {
      this.advance();
      return { type: 'String', value: token.value };
    }

    if (token.type === 'BOOLEAN') {
      this.advance();
      return { type: 'Boolean', value: token.value === 'VRAI' || token.value === 'TRUE' };
    }

    if (token.type === 'RANGE') {
      this.advance();
      const parts = token.value.split(':');
      const startCoord = addressToCoord(parts[0])!;
      const endCoord = addressToCoord(parts[1])!;
      return {
        type: 'Range',
        address: token.value,
        start: startCoord,
        end: endCoord
      };
    }

    if (token.type === 'CELL') {
      this.advance();
      // Check if immediately followed by ':' which wasn't caught in lexer
      if (this.peek().value === ':') {
        this.advance(); // consume ':'
        const next = this.peek();
        if (next.type === 'CELL') {
          this.advance();
          const startCoord = addressToCoord(token.value)!;
          const endCoord = addressToCoord(next.value)!;
          return {
            type: 'Range',
            address: `${token.value}:${next.value}`,
            start: startCoord,
            end: endCoord
          };
        }
      }
      return {
        type: 'CellRef',
        address: token.value,
        coord: addressToCoord(token.value)!
      };
    }

    if (token.type === 'IDENTIFIER') {
      this.advance();
      const fnName = token.value;

      if (this.check('LPAREN')) {
        this.advance(); // consume '('
        const args: ASTNode[] = [];

        if (!this.check('RPAREN')) {
          do {
            args.push(this.parseExpression());
          } while (this.match('SEMICOLON') || this.match('COMMA'));
        }

        this.consume('RPAREN', `Expected ')' after function arguments for ${fnName}`);
        return {
          type: 'FunctionCall',
          name: fnName,
          args
        };
      } else {
        // Identifier without parentheses -> could be invalid function or reference
        return {
          type: 'FunctionCall',
          name: fnName,
          args: []
        };
      }
    }

    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.consume('RPAREN', "Expected ')' after expression");
      return expr;
    }

    throw new Error(`Unexpected token at position ${token.pos}: '${token.value || 'EOF'}'`);
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private matchOperator(...ops: string[]): boolean {
    if (this.peek().type === 'OPERATOR' && ops.includes(this.peek().value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '', pos: 0 };
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private get pos(): number {
    return this.current;
  }
  private set pos(val: number) {
    this.current = val;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`${message} (at pos ${this.peek().pos})`);
  }
}
