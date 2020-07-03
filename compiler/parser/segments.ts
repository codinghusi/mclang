import { TokenStream } from "../lexer";
import { CodeParser } from "./parser";

// TODO: make some interfaces for all AST Nodes
export interface CodeSegmentResult {
    matched: boolean;
    skip?: boolean;
}

export interface CodeSegmentResultWithData extends CodeSegmentResult {
    key: string;
    data: any;
}

export type CodeSegment = (tokenStream: TokenStream) => CodeSegmentResult | CodeSegmentResultWithData;

export const Segments = {
    expect(key: string, type: string, value: string): CodeSegment {
        return (tokenStream: TokenStream) => {
            const token = tokenStream.peek();
            const matched = token.value === value && token.type === type;
            if (key) {
                return {
                    matched,
                    skip: true,
                    data: token.value,
                    key
                };
            }
            return {
                matched,
                skip: true,
            };
        }
    },
    expectType(key: string, type: string) {
        return (tokenStream: TokenStream) => {
            const token = tokenStream.peek();
            const matched = token.type === type;
            if (key) {
                return {
                    matched,
                    skip: true,
                    data: token.value,
                    key
                };
            }
            return {
                matched,
                skip: true,
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
            throw new Error(msg)
        }
    },
    debugSkip(): CodeSegment {
        return tokenStream => {
            console.log(`skipped ${tokenStream.next().value}`);
            return {
                matched: false
            };
        }
    },
    until(key: string, end: CodeSegment, parser: CodeParser): CodeSegment {
        return tokenStream => {
            const values = [];
            while (!end(tokenStream).matched) {
                const result = parser.run('asdf', tokenStream);
                if ('data' in result) {
                    values.push(result.data);
                }
            }
            if (end(tokenStream).skip) {
                tokenStream.next();
            }
            return {
                matched: true,
                skip: false,
                data: values,
                key
            };
        };
    },
    untilEOF(key: string, parser: CodeParser): CodeSegment {
        return tokenStream => {
            const values = [];
            while (!tokenStream.eof()) {
                const tokenValue = tokenStream.peek().value;
                const result = parser.run('asdf', tokenStream);
                console.log(`token: ${tokenValue}, matched: ${result.matched}, skip: ${result.skip}`);
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
}