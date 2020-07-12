import { TokenStream } from "../tokenstream";
import { Result } from "./result";
import { ParserDebugger } from './debugging';

export class Segment {
    public key: string;
    constructor(private fn: (tokenStream: TokenStream, context: Segment) => Result,
                public debuggingCode?: string) { }

    run(tokenStream: TokenStream) {
        if (this.debuggingCode) {
            ParserDebugger.indent();
            ParserDebugger.debug(this.debuggingCode);
        }
        const checkpoint = tokenStream.checkpoint();
        const result = this.fn(tokenStream, this);
        if (!result.matched()) {
            checkpoint.revert();
            // console.log('reverted to ' + tokenStream.inputStream.position);
        } else {
            if (this.key) {
                result.setKey(this.key);
            }
        }
        if (this.debuggingCode) {
            if (!result.matched()) {
                ParserDebugger.debug(`-> failed: ${result.failMessage}`);
            }
            ParserDebugger.unindent();
        }
        return result;
    }

    as(key: string) {
        this.key = key;
        return this;
    }
}
