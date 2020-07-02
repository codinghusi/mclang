

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