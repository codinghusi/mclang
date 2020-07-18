import { InputStream, InputStreamCheckpoint } from './inputstream';

export interface Token {
    type: string;
    value: number | string;
    line: number,
    column: number
}

type TokenParser = (inputStream: InputStream) => string
export type TokenValue = string | number;

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
                private conversion?: (token: Token) => Token) {
    }

    read(inputStream: InputStream): Token {
        for (const parser of this.parsers) {
            let value: TokenValue = parser(inputStream);
            if (value) {
                const token = {
                    type: this.type,
                    value,
                    line: inputStream.line,
                    column: inputStream.column
                };
                if (this.conversion) {
                    return this.conversion(token);
                }
                return token;
            }
        };
        return null;
    }
}


export class TokenStreamCheckpoint {
    constructor(private tokenStream: TokenStream,
                private inputStreamCheckpoint: InputStreamCheckpoint) {
                    console.log('new checkpoint at ' + inputStreamCheckpoint.line + ':' + inputStreamCheckpoint.column + ', ' + inputStreamCheckpoint.position);
                }
    
    get progress() {
        return this.tokenStream.inputStream.position - this.inputStreamCheckpoint.position;
    }

    revert() {
        this.inputStreamCheckpoint.revert();
        this.tokenStream.current = null;
        this.tokenStream.updateCheckpoint();
        console.log('reverted to ' + this.inputStreamCheckpoint.line + ':' + this.inputStreamCheckpoint.column + ', ' + this.inputStreamCheckpoint.position);
    }

    toJSON() {
        return this.inputStreamCheckpoint.toJSON();
    }
}

export class TokenStream {

    constructor(public inputStream: InputStream,
                private layouts: TokenLayout[],
                private skipTokens: string[] = []) {
        this.updateCheckpoint();
    }


    public current: Token = null;
    private currentCheckpoint: TokenStreamCheckpoint;
    
    private read_next(): Token {
        for (const layout of this.layouts) {
            if (this.inputStream.eof()) {
                return null;
            }

            const token = layout.read(this.inputStream);
            if (token) {
                if (this.skipTokens.some(type => type === token.type)) {
                    return this.read_next();
                }
                return token;
            }
        };

        // If nothing worked return unknown so that jsfunction can work with unknown chars
        return {
            type: 'unknown',
            value: this.inputStream.next(),
            line: this.inputStream.line,
            column: this.inputStream.column
        };
    }

    peek() {
        return this.current ?? (this.current = this.read_next());
    }

    next() {
        const tmp = this.current;
        this.current = null;
        const result = tmp ?? this.read_next();
        this.updateCheckpoint();
        return result;
    }

    eof() {
        return !this.peek();
    }

    updateCheckpoint() {
        this.currentCheckpoint = new TokenStreamCheckpoint(this, this.inputStream.checkpoint());
    }

    checkpoint() {
        return this.currentCheckpoint;
    }
}