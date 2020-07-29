import { TokenStream } from "../tokenstream";
import { Result } from "./result";
import { ParserDebugger } from './debugging';
import { Reference } from "./reference";

export class Segment {
    public key: string = null;
    private _doSkip = false;
    private _dontSkip = false;
    private _flatten: boolean = null;
    constructor(private fn: (tokenStream: TokenStream, context: Segment, data?: any) => Result,
                public debuggingCode?: string) { }

    run(tokenStream: TokenStream, data?: any) {
        if (this.debuggingCode) {
            ParserDebugger.indent();
            ParserDebugger.debug(this.debuggingCode);
        }
        const checkpoint = tokenStream.checkpoint();
        const result = this.fn(tokenStream, this, data);
        
        if (!result.position) {
            result.setPosition(tokenStream.inputStream.checkpoint());
        }
        
        result.setProgress(checkpoint.progress);
        if (!result.matched()) {
            if (!result.failMessage) {
                const token = tokenStream.peek();
                result.setFailInfo(`Unexpected ${token.type} ${token.value}`);
            }
            if (!this._dontSkip || this._doSkip) {
                checkpoint.revert();
            }
        }
        else {
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

        if (this._flatten !== null) {
            result.setFlatten(this._flatten);
        }

        return result;
    }

    flatten(flatten = true) {
        this._flatten = flatten;
        return this;
    }

    flattened() {
        return this._flatten;
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
        if (key === 'init') {
            // console.log('key init', this);
        }
        return this;
    }
}
