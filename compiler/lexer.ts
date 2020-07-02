import { InputStream } from './inputstream';

interface Token {
    type: string;
    value: number | string;
}





export class TokenStream {
    private keywords = [ 'let', 'const', 'listen', 'event', 'if', 'else', 'true', 'false', 'function', 'class', 'for', 'forEach' ];
    private operators = [ '+', '-', '*', '/', '%', '=', '+=', '-=', '/=', '*=', '%=', '<', '>', '>=', '<=', '==', '!=', '&&', '||' ];

    private singleLineCommentStart = '//';
    private multiLineCommentStart = '/*';
    private singleQuoteStringStart = "'";
    private doubleQuoteStringStart = '"';

    private current: Token = null;

    constructor(private inputStream: InputStream) { }

    position() {
        return {
            line: this.inputStream.line,
            col: this.inputStream.col
        }
    }

    TokenNumber(number: string) {
        return {
            type: 'number',
            value: parseFloat(number),
            ...this.position()
        };
    }
    
    TokenString(string: string) {
        return {
            type: 'string',
            value: string,
            ...this.position()
        };
    }
    
    TokenKeyword(keyword: string) {
        return {
            type: 'keyword',
            value: keyword,
            ...this.position()
        }
    }
    
    TokenName(name: string) {
        return {
            type: 'name',
            value: name,
            ...this.position()
        }
    }
    
    TokenPunctuation(punctuation: string) {
        return {
            type: 'punctuation',
            value: punctuation,
            ...this.position()
        }
    }
    
    TokenOperator(operator: string) {
        return {
            type: 'operator',
            value: operator,
            ...this.position()
        }
    }


    private is_keyword(str: string) {
        return this.keywords.includes(str);
    }

    private is_digit(char: string) {
        return /\d/.test(char);
    }

    private is_identifier_start(char: string) {
        return /[a-z_]/i.test(char);
    }

    private is_identifier(char: string) {
        return this.is_identifier_start(char) || /\w/.test(char);
    }

    private read_operator() {
        const operator = this.operators
            .sort((a, b) => b.length - a.length)
            .find(operator => this.inputStream.is_next_maybe_skip(operator));

        if (operator) {
            return this.TokenOperator(operator);
        }
        return null;
    }

    private is_punctuation(char: string) {
        return /[\,\;\(\)\{\}\[\]]/.test(char);
    }

    private is_whitespace(char: string) {
        return /\s/.test(char);
    }

    private map_escaped_character(char: string) {
        if (char === 'n') {
            return '\n';
        }
        return char;
    }

    private read_while(predicate: (str: string) => boolean, escaping = false) {
        let result = '';
        let escaped = false;
        while (!this.inputStream.eof()) {
            let char = this.inputStream.peek();

            if (escaping && char === '\\') {
                escaped = true;
                this.inputStream.skip();
                continue;
            }

            if (escaped || predicate.call(this, char)) {
                if (escaped) {
                    char = this.map_escaped_character(char);
                }
                result += char;
                escaped = false;
                this.inputStream.skip();
            } else {
                return result;
            }
        }
        predicate.call(this, undefined);
        return result;
    }

    private read_until(end: string, escaping = false) {
        return this.read_while((char: string) => {
            if (char === undefined) {
                throw new Error(`Reached end of code but expected a ${end}`);
            }
            return !this.inputStream.is_next_maybe_skip(end);
        }, escaping);
    }

    private read_number() {
        let has_dot = false;
        const number = this.read_while((char: string) => {
            if (char === '.') {
                if (has_dot) {
                    throw new Error("unexpected char .");
                }
                has_dot = true;
                return this.is_digit(char);
            }
        });
        return this.TokenNumber(number);
    }

    private read_identifier() {
        const id = this.read_while(this.is_identifier);
        if (this.is_keyword(id)) {
            return this.TokenKeyword(id);
        }
        return this.TokenName(id);
    }

    private read_string_single_quote() {
        const string = this.read_until("'", true);
        return this.TokenString(string);
    }

    private read_string_double_quote() {
        const string = this.read_until('"', true);
        return this.TokenString(string);
    }

    private read_punctuation() {
        const punctuation = this.inputStream.next();
        return this.TokenPunctuation(punctuation);
    }

    private skip_line() {
        this.read_until('\n');
    }

    private skip_multiline_comment() {
        this.read_until('*/');
    }

    private dont_expect(predicate: (char: string) => boolean) {
        const char = this.inputStream.peek()
        if (predicate.call(this, char)) {
            throw new Error(`Unexpected character ${char}`);
        }
    }

    private read_next(): Token {
        this.read_while(this.is_whitespace);
        if (this.inputStream.eof()) {
            return null;
        }

        const char = this.inputStream.peek();

        // COMMENTS
        // Single Line
        if (this.inputStream.is_next_maybe_skip(this.singleLineCommentStart)) {
            this.skip_line();
            return this.read_next();
        }
        // Multi Line
        if (this.inputStream.is_next_maybe_skip(this.multiLineCommentStart)) {
            this.skip_multiline_comment();
            return this.read_next();
        }

        // STRINGS
        // Single Quote
        if (this.inputStream.is_next_maybe_skip(this.singleQuoteStringStart)) {
            return this.read_string_single_quote();
        }
        // Double Quote
        if (this.inputStream.is_next_maybe_skip(this.doubleQuoteStringStart)) {
            return this.read_string_double_quote();
        }

        // NUMBERS
        if (this.is_digit(char)) {
            return this.read_number();
        }

        // IDENTIFIERS
        if (this.is_identifier_start(char)) {
            return this.read_identifier();
        }

        // PUNCTUATION
        if (this.is_punctuation(char)) {
            return this.read_punctuation();
        }

        // OPERATOR
        const operator = this.read_operator();
        if (operator !== null) {
            return operator;
        }

        // Nothing
        throw new Error(`Unexpected Character ${char}`);
    }

    peek() {
        return this.current ?? (this.current = this.read_next());
    }

    next() {
        const tmp = this.current;
        this.current = null;
        return tmp ?? this.read_next();
    }

    eof() {
        return this.peek() === null;
    }
}