import { TokenStream } from "../tokenstream";
import { Result } from "./result";
import { ParserDebugger } from './debugging';
import { Reference } from "./reference";

export class Segment {
    public key: string;
    private _doSkip = false;
    private _dontSkip = false;
    constructor(private fn: (tokenStream: TokenStream, context: Segment, data?: any) => Result,
                public debuggingCode?: string) { }

    run(tokenStream: TokenStream, data?: any) {
        if (this.debuggingCode) {
            ParserDebugger.indent();
            ParserDebugger.debug(this.debuggingCode);
        }
        const checkpoint = tokenStream.checkpoint();
        const result = this.fn(tokenStream, this, data);
        result.setProgress(checkpoint.progress);
        if (!result.matched() && !this._dontSkip || this._doSkip) {
            checkpoint.revert();
            if (!result.failMessage) {
                const token = tokenStream.peek();
                result.setFailInfo(`Unexpected ${token.type} ${token.value}`);
            }
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
        if (result.type) {
            result.setReference(new Reference(checkpoint, tokenStream.checkpoint()));
        }
        return result;
    }

    doSkip(skip = true) {
        this._doSkip = skip;
        return this;
    }
    
    dontSkip(dontSkip = true) {
        this._dontSkip = dontSkip;
        return this;
    }

    as(key: string) {
        this.key = key;
        return this;
    }
}
