import { TokenStream, TokenStreamCheckpoint } from '../tokenstream';
import { CodeParser, Parser } from "./parser";
import { InputStreamCheckpoint } from '../inputstream';

// TODO: make some interfaces for all AST Nodes

export type CodeSegment = (tokenStream: TokenStream) => Result;

export class Result {
    private _matched = false;
    private _hasData = false;
    private _checkpoint: TokenStreamCheckpoint;
    public data: any = {};
    public failMessage: string;
    public key: string;
    public type: string;

    constructor(private tokenStream: TokenStream) {
        this._checkpoint = this.tokenStream.checkpoint();
    }

    get progress() {
        return this._checkpoint.progress;
    }

    setMatch(hasMatch = true, failMessage?: string) {
        this._matched = hasMatch;
        if (!this._matched) {
            this.failMessage = failMessage;
        }
        return this;
    }

    setKey(key: string) {
        this.key = key;
        return this;
    }

    setType(type: string) {
        this.type = type;
        return this;
    }

    add(key: string, value: any) {
        // Shorthand: if no key is provided it does nothing (So the content won't be in the result if not wanted)
        if (key) {
            this.data[key] = value;
            this._hasData = true;
        }
        return this;
    }

    addToArray(key: string, value: any) {
        if (key) {
            let array = this.data[key] || [];
            this.data[key] = array;
            array.push(value);
            this._hasData = true;
        }
        return this;
    }

    setData(data: any) {
        this.data = data;
        this._hasData = true;
        return this;
    }

    addData(data: any) {
        Object.assign(this.data, data);
        this._hasData = true;
        return this;
    }

    addResult(result: Result) {
        if (result.hasData()) {
            this.addData(result.data);
        }
        return this;
    }

    useParser(key: string, parser: CodeParser) {
        const result = parser.run(key, this.tokenStream);
        if (result.handle()) {
            if (result.hasData()) {
                if (result.key) {
                    this.add(result.key, result.data);
                } else {
                    this.addData(result.data);
                }
            }
        }
        return result;
    }

    handle() {
        if (this.matched()) {
            return true;
        }
        this.discard();
        return false;
    }

    discard() {
        this._checkpoint.revert();
    }

    hasData() {
        return this._hasData && this.matched();
    }

    matched() {
        return this._matched;
    }
}

export const Segments = {
    expect(type: string, value: string): CodeSegment {
        return (tokenStream) => {
            const token = tokenStream.next();
            const failMessage = `Expected ${type} ${value} but got ${token.value}`;
            const matched = token.value === value && token.type === type;

            console.log(`expected ${type} ${value} and got ${token.type} ${token.value}`);

            return new Result(tokenStream)
                .setMatch(matched, failMessage);
        }
    },
    expectType(type: string, key?: string): CodeSegment {
        return (tokenStream) => {
            const token = tokenStream.next();
            const failMessage = `Expected ${type} but got ${token.type}`;
            const matched = token.type === type;

            console.log(`expected ${type} and got ${token.type}`);

            return new Result(tokenStream)
                .setMatch(matched, failMessage)
                .add(key, token.value);
        }
    },
    maybe(type: string, value: string, key?: string): CodeSegment {
        return (tokenStream) => {
            const token = tokenStream.peek();
            const skip = token.value === value && token.type === type;
            const matched = true;

            if (skip) {
                tokenStream.next();
            }

            return new Result(tokenStream)
                .setMatch(matched)
                .add(key, token.value);
        }
    },
    doesntMatter(): CodeSegment {
        return (tokenStream) => new Result(tokenStream).setMatch(true);
    },
    dont(): CodeSegment {
        return (tokenStream) => new Result(tokenStream).setMatch(false);
    },
    fail(message: string): CodeSegment {
        return (tokenStream) => new Result(tokenStream).setMatch(false, message);
    },
    debugSkip(): CodeSegment {
        return (tokenStream) => new Result(tokenStream).setMatch(false);
    },
    until(key: string, end: CodeSegment, parser: CodeParser): CodeSegment {
        return Segments.delimitted(key, Segments.doesntMatter(), end, Segments.doesntMatter(), parser);
    },
    untilEOF(key: string, parser: CodeParser): CodeSegment {
        return (tokenStream) => {
            const result = new Result(tokenStream);
            while (!tokenStream.eof()) {
                const parserResult = parser.run(null, tokenStream);
                if (!parserResult.handle()) {
                    return parserResult;
                }
                if (parserResult.hasData()) {
                    result.addToArray(key, parserResult.data);
                }
            }
            return result.setMatch(true);
        };
    },
    delimitted(key: string, from: CodeSegment, to: CodeSegment, seperator: CodeSegment, parser: CodeParser | string): CodeSegment {
        return (tokenStream) => {
            const result = new Result(tokenStream);

            const fromResult = from(tokenStream);
            if (!fromResult.handle()) {
                return fromResult;
            }

            while (!to(tokenStream).handle()) {
                const parserResult = result.useParser(null, CodeParser.resolveParser(parser));
                if (!parserResult.matched()) {
                    return result;
                }

                if (parserResult.hasData()) {
                    result.addToArray(key, parserResult.data);
                }

                if (!seperator(tokenStream).handle()) {
                    break;
                }
            }
            return result
                .setMatch(true)
                .setType(this.astType ?? undefined);
        };
    }
}