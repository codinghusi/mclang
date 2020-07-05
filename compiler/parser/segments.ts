import { TokenStream } from "../lexer";
import { CodeParser } from "./parser";

// TODO: make some interfaces for all AST Nodes
export interface CodeSegmentResult {
    matched: boolean;
    skip?: boolean;
    failed?: boolean;
    failMsg?: string;
    key?: string;
    data?: any;
    type?: string;
}

export type CodeSegment = (tokenStream: TokenStream) => CodeSegmentResult;

export const Segments = {
    expect(key: string, type: string, value: string): CodeSegment {
        return (tokenStream: TokenStream) => {
            const token = tokenStream.peek();
            const failMsg = `Expected ${type} ${value} but got ${token.value}`;
            const matched = token.value === value && token.type === type;
            if (key) {
                return {
                    matched,
                    skip: true,
                    data: token.value,
                    key,
                    failMsg
                };
            }
            return {
                matched,
                skip: true,
                failMsg
            };
        }
    },
    expectType(key: string, type: string) {
        return (tokenStream: TokenStream) => {
            const token = tokenStream.peek();
            const failMsg = `Expected ${type} but got ${token.type}`;
            const matched = token.type === type;
            if (key) {
                return {
                    matched,
                    skip: true,
                    data: token.value,
                    key,
                    failMsg
                };
            }
            return {
                matched,
                skip: true,
                failMsg
            };
        }
    },
    maybe(key: string, type: string, value: string): CodeSegment {
        return tokenStream => {
            const token = tokenStream.peek();
            const skip = token.value === value && token.type === type;
            if (key) {
                return {
                    matched: true,
                    skip,
                    data: token.value,
                    key
                };
            }
            return {
                matched: true,
                skip,
            };
        }
    },
    doesntMatter(): CodeSegment {
        return tokenStream => {
            return {
                matched: true,
                skip: false
            };
        };
    },
    dont(): CodeSegment {
        return tokenStream => {
            return {
                matched: false,
                skip: false
            };
        };
    },
    fail(msg: string): CodeSegment {
        return tokenStream => {
            return { matched: false, failed: true, failMsg: msg };
        }
    },
    debugSkip(): CodeSegment {
        return tokenStream => {
            return {
                matched: false
            };
        }
    },
    until(key: string, end: CodeSegment, parser: CodeParser): CodeSegment {
        return Segments.delimitted(key, Segments.doesntMatter(), end, Segments.doesntMatter(), parser);
    },
    untilEOF(key: string, parser: CodeParser): CodeSegment {
        return tokenStream => {
            const values = [];
            while (!tokenStream.eof()) {
                const tokenValue = tokenStream.peek().value;
                const result = parser.run('asdf', tokenStream);
                // TODO: maybe fail if parser failed
                console.log(`untilEOF(): token: ${tokenValue}, matched: ${result.matched}, skip: ${result.skip}`);
                if ('data' in result) {
                    values.push(result.data);
                }
            }
            return {
                matched: true,
                skip: false,
                data: values,
                key
            };
        };
    },
    delimitted(key: string, from: CodeSegment, to: CodeSegment, seperator: CodeSegment, parser: CodeParser | string): CodeSegment {
        return tokenStream => {
            const values = [];

            const fromResult = from(tokenStream)
            if (!fromResult.matched) {
                return { matched: false, failed: true };
            }
            if (fromResult.skip) {
                tokenStream.next();
            }

            while (!to(tokenStream).matched) {
                const result = CodeParser.resolveParser(parser).run(null, tokenStream);
                if (!result.matched) {
                    return { matched: false, failed: true, failMsg: result.failMsg };
                }
                if ('data' in result) {
                    values.push(result.data);
                }

                const seperatorResult = seperator(tokenStream);
                if (!seperatorResult.matched) {
                    break;
                } else if (seperatorResult.skip) {
                    tokenStream.next();
                }
            }
            if (to(tokenStream).skip) {
                tokenStream.next();
            }
            return {
                matched: true,
                skip: false,
                data: values,
                key,
                type: this.astType ?? undefined
            };
        };
    }
}