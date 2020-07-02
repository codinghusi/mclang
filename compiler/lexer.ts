import { InputStream } from './inputstream';

interface Token {
    type: string;
    value: number | string;
    line: number,
    column: number
}

type TokenParser = (inputStream: InputStream) => string
type TokenValue = string | number;


export const TokenPattern = {
    Between(from: string, to: string, escaping: string = null) {
        return (inputStream: InputStream) => {
            if (inputStream.is_next_maybe_skip(from)) {
                return inputStream.read_until(to, escaping);
            }
            return null;
        }
    },
    RegEx(regex: RegExp) {
        return (inputStream: InputStream) => {
            return inputStream.read_regex(regex);
        }
    },
    OneOf(chars: string) {
        return (inputStream: InputStream) => {
            if (chars.indexOf(inputStream.peek()) >= 0) {
                return inputStream.next();
            }
            return null;
        }
    },
    OneOfEntry(strings: string[]) {
        return (inputStream: InputStream) => {
            return strings
                .sort((a, b) => b.length - a.length)
                .find(string => inputStream.is_next_maybe_skip(string));
        }
    },
}

export class TokenLayout {
    constructor(private type: string,
                private parsers: TokenParser[],
                private conversion?: (value: string) => TokenValue) {
    }

    read(inputStream: InputStream): Token {
        for (const parser of this.parsers) {
            let value: TokenValue = parser(inputStream);
            if (value) {
                if (this.conversion) {
                    value = this.conversion(value);
                }
                return {
                    type: this.type,
                    value,
                    line: inputStream.line,
                    column: inputStream.column
                };
            }
        };
        return null;
    }
}



export class TokenStream {

    constructor(private inputStream: InputStream,
                private layouts: TokenLayout[],
                private skipTokens: string[] = []) {

    }

    // private keywords = [ 'let', 'const', 'listen', 'event', 'if', 'else', 'true', 'false', 'function', 'class', 'for', 'forEach' ];
    // private operators = [ '+', '-', '*', '/', '%', '=', '+=', '-=', '/=', '*=', '%=', '<', '>', '>=', '<=', '==', '!=', '&&', '||' ];

    private current: Token = null;


    
    private read_next(): Token {
        for (const layout of this.layouts) {
            if (this.inputStream.eof()) {
                return null;
            }

            const token = layout.read(this.inputStream);
            if (token) {
                if (this.skipTokens.some(type => type === token.type)) {
                    continue;
                }
                return token;
            }
        };

        // Nothing worked
        throw new Error(`Unexpected Character ${this.inputStream.peek()}`);
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
        return !this.peek();
    }
}