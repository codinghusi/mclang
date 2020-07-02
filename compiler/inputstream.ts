

export class InputStream {
    private pos = 0;
    public line = 1;
    public col = 0;

    constructor(private input: string) { }

    next() {
        // Get the char and go next
        const ch = this.peek();
        this.skip();

        // Adjust some debugging/error/tracking variables
        if (ch == '\n') {
            this.line++;
            this.col = 0;
        } else {
            this.col++;
        }

        // return the result
        return ch;
    }

    is_next_maybe_skip(string: string) {
        if (this.input.substr(this.pos, string.length) === string) {
            this.skip(string.length);
            return true;
        }
        return false;
    }

    private map_escaped_character(char: string) {
        if (char === 'n') {
            return '\n';
        }
        return char;
    }

    read_while(predicate: (str: string) => boolean, escaping: string = null) {
        let result = '';
        let escaped = false;
        while (!this.eof()) {
            let char = this.peek();

            if (escaping && char === escaping) {
                escaped = true;
                this.skip();
                continue;
            }

            if (escaped || predicate.call(this, char)) {
                if (escaped) {
                    char = this.map_escaped_character(char);
                }
                result += char;
                escaped = false;
                this.skip();
            } else {
                return result;
            }
        }
        predicate.call(this, undefined);
        return result;
    }

    read_until(end: string, escaping?: string) {
        return this.read_while((char: string) => {
            if (char === undefined) {
                throw new Error(`Reached end of code but expected a ${end}`);
            }
            return !this.is_next_maybe_skip(end);
        }, escaping);
    }

    read_regex(regex: RegExp) {
        const result = this.input.slice(this.pos).match(regex);
        if (result !== null) {
            this.skip(result.length);
        }
        return result;
    }

    skip(amount = 1) {
        this.pos += amount;
    }

    peek(seek = 0) {
        return this.input.charAt(this.pos + seek);
    }

    eof() {
        return this.input.length <= this.pos;
    }

    error(message: string) {
        throw new Error(`Error at line ${this.line}|${this.col}: ${message}`);
    }
}