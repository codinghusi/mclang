
export class InputStreamCheckpoint {
    public position = 0;
    public line = 1;
    public column = 0
    
    constructor(private inputStream: InputStream) {
        this.position = inputStream.position;
        this.line = inputStream.line;
        this.column = inputStream.column;
    }
    
    revert() {
        this.inputStream.position = this.position;
        this.inputStream.line = this.line;
        this.inputStream.column = this.column;
    }

    toJSON() {
        return {
            line: this.line,
            column: this.column
        }
    }
}


export class InputStream {
    public position = 0;
    public line = 1;
    public column = 0;

    constructor(private input: string) { }

    next() {
        // Get the char and go next
        const ch = this.peek();
        this.skip();

        // return the result
        return ch;
    }

    is_next_maybe_skip(string: string) {
        if (this.input.substr(this.position, string.length) === string) {
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

    read_regex(regex: RegExp): string {
        const result = this.input.slice(this.position).match(regex);
        if (result !== null) {
            this.skip(result[0].length);
            return result[0];
        }
        return null;
    }

    skip(amount = 1) {
        this.position += amount;

        // Adjust some debugging/error/tracking variables
        if (this.peek() == '\n') {
            this.line++;
            this.column = 0;
        } else {
            this.column++;
        }
    }

    peek(seek = 0) {
        return this.input.charAt(this.position + seek) || undefined;
    }

    eof() {
        return this.position >= this.input.length;
    }

    error(message: string) {
        throw new Error(`Error at line ${this.line}|${this.column}: ${message}`);
    }

    checkpoint() {
        return new InputStreamCheckpoint(this);
    }
}