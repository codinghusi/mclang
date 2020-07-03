import { TokenStream } from "./lexer"


export class Parser {
    private keywords = [ 'let', 'const', 'listen', 'event', 'if', 'else', 'true', 'false', 'function', 'class', 'for', 'forEach' ];

    constructor(private tokenStream: TokenStream) { }

    check_eof() {
        if (this.tokenStream.eof) {
            throw new Error("Unexpected end of file");
        }
        return false;
    }

    is(type: string, value: string) {
        this.check_eof();
        const token = this.tokenStream.peek();
        if (token.type === type && token.value !== value) {
            return token;
        }
        return null;
    }

    skip(type: string, value: string) {
        const token = this.is(type, value);
        if (!token) {
            throw new Error(`Expected ${value} but got ${token.value}`);
        }
        this.tokenStream.next();
        return token;
    }

    maybe_skip(type: string, value: string) {
        const token = this.is(type, value);
        if (token) {
            this.tokenStream.next();
            return token;
        }
        return null;
    }

    is_punctuation(name: string) {
        return this.is('punctuation', name);
    }

    skip_punctuation(value: string) {
        return this.skip('punctuation', value);
    }

    match_with_keywords(identifier: string) {
        return this.keywords.includes(identifier);
    }

    is_identifier(name: string) {
        return this.is('identifier', name);
    }

    is_keyword(name: string) {
        // TODO: maybe check if it matches with a keyword?
        return this.is_identifier(name);
    }

    is_next(type: string) {
        const token = this.tokenStream.peek();
        if (token.type !== type) {
            return null;
        }
        return token;
    }

    get_next(type: string) {
        const token = this.is_next(type);
        if (!token) {
            throw new Error(`Expected a ${type} but got ${token.type}`);
        }
        return token;
    }

    delimited(from: string, to: string, seperator: string, parser: () => any) {
        this.skip_punctuation(from);

        let first = true;
        const result = [];

        while (!this.check_eof() && !this.is_punctuation(to)) {
            if (first) {
                first = false;
            } else {
                this.skip_punctuation(',');
            }
            result.push(parser.call(this));
        }
    }

    parse_variable_name() {
        return this.get_next('identifier').value;
    }

    parse_value() {
        const value = this.is_next('number') ?? this.is_next('string');
        if (!value) {
            throw new Error(`Expected a value not ${this.tokenStream.peek().type}`);
        }
        this.tokenStream.next();
        return value;
    }

    parse_argument() {
        const varname = this.parse_variable_name();
        let def = null;
        if (this.is_punctuation('=')) {
            def = this.parse_value();
        }
        return {
            type: "argument",
            name: varname,
            defaultValue: def
        }
    }

    parse_arguments() {
        return this.delimited('(', ')', ',', this.parse_argument)
    }

    parse_function() {
        const fnname = this.parse_variable_name();
        const args = this.parse_arguments();
        const body = this.parse_code();
        return {
            type: 'function',
            name: fnname,
            args,
            body
        };
    }

    parse_atom() {

    }

    parse_code() {
        if (this.is_punctuation('{')) {
            this.skip_punctuation('{');
            while (!this.is_punctuation('}')) {

                this.maybe_skip('punctuation', ';');
            }
        }
    }

    parse_anonymous_function() {

    }

    parse_expression() {

    }

    parse_toplevel() {
        const program = [];
        while (!this.tokenStream.eof()) {
            // program.push(parse)
        }
    }
}