import { TokenStream } from '../lexer';
import { CodeSegment, Segments, CodeSegmentResult } from './segments';

export class CodeParser {
    private segments: CodeSegment[] = [];
    private astType: string;

    private convertFunction = (raw: any) => {
        return raw;
    };

    static codeParsers: CodeParser[] = [];

    static register(parser: CodeParser) {
        this.codeParsers.push(parser);
    }

    constructor(public name?: string) {
        // TODO: maybe register here
        this.type(name);
    }

    type(type: string) {
        this.astType = type;
    }

    expect(key: string, type: string, value: string) {
        this.segment(Segments.expect(key, type, value));
        return this;
    }

    expectType(key: string, type: string) {
        this.segment(Segments.expectType(key, type));
        return this;
    }

    maybe(parser: CodeParser | string) {
        this.segment(tokenStream => {
            parser = this.resolveParser(parser);
            
            console.log(`Parser(${this.name ?? 'unnamed'}).maybe(parser: ${parser.name ?? 'unnamed'})`);
            
            const result = parser.run(null, tokenStream);
            if (!result.matched) {
                return {
                    matched: true,
                    skip: false
                };
            }
            return result;
        })
        return this;
    }

    register(parser: CodeParser) {
        CodeParser.register(parser);
        return this;
    }

    static getRegisteredParser(name: string) {
        return CodeParser.codeParsers.find(parser => parser.name === name);
    }

    private getRegisteredParser(name: string) {
        if (this.name === name) {
            return this;
        }
        return CodeParser.getRegisteredParser(name);
    }

    static resolveParser(parser: CodeParser | string) {
        if (typeof parser === 'string') {
            const newParser = this.getRegisteredParser(parser);
            if (!newParser) {
                throw new Error(`Parser with name '${parser}' doesn't exist`);
            }
            return newParser;
        } else {
            this.register(parser);
        }
        return parser;
    }

    resolveParser(parser: CodeParser | string) {
        return CodeParser.resolveParser(parser);
    }

    parse(key: string, parser: CodeParser | string) {
        this.segment(tokenStream => {
            parser = this.resolveParser(parser);
            
            console.log(`Parser(${this.name ?? 'unnamed'}).parse(key: ${key}, parser: ${parser.name ?? 'unnamed'})`);
            
            const result = (parser as CodeParser).run(key, tokenStream);
            return result;
        });
        return this;
    }

    segment(segment: CodeSegment) {
        this.segments.push(segment);
        return this;
    }

    join(key: string, ...parsers: (CodeParser | string)[] ) {
        this.segment(
            (tokenStream: TokenStream) => {
                const resolvedParsers = parsers.map(parser => this.resolveParser(parser));
                for (const parser of resolvedParsers) {

                    const result = parser.run(key, tokenStream);
                    if (result.matched) {
                        return result;
                    }
                }
                return {
                    matched: false
                };
            }
        );
        return this;
    }

    delimitted(key: string, from: CodeSegment, to: CodeSegment, seperator: CodeSegment, parser: CodeParser | string) {
        this.segment(Segments.delimitted(key, from, to, seperator, parser));
        return this;
    }

    convert(convertFn: (raw: any) => any) {
        this.convertFunction = convertFn;
        return this;
    }

    untilEOF(key: string, parser: CodeParser | string) {
        this.segment(tokenStream => {
            parser = this.resolveParser(parser);
            return Segments.untilEOF(key, parser)(tokenStream);
        });
        return this;
    }

    until(key: string, end: CodeSegment, parser: CodeParser | string) {
        this.segment(tokenStream => {
            parser = this.resolveParser(parser);
            return Segments.until(key, end, parser)(tokenStream);
        });
        return this;
    }

    private isKeySayingArray(keyname: string) {
        return /\[\]$/.test(keyname);
    }

    error(result: CodeSegmentResult, tokenStream: TokenStream) {
        const token = tokenStream.peek();
        const prefix = `Problem with line ${token.line}:${token.column}: `;
        if (result.failMsg) {
            throw new Error(prefix + result.failMsg);
        } else {
            throw new Error(prefix + `Unexpected ${token.type} ${token.value}`);
        }
    }

    // TODO: please add comments to this mess
    toSegment(key: string): CodeSegment {
        return tokenStream => {
            const values: any = {};
            let first = true;
            let i = 0;
            for (const segment of this.segments) {
                const result = segment(tokenStream);
                if (result.failed) {
                    this.error(result, tokenStream);
                }
                if (result.matched) {
                    if (result.skip) {
                        tokenStream.next();
                    }
                    if ('data' in result) {
                        const k = result.key;
                        if (!k) {
                            Object.assign(values, result.data);
                        } else {
                            if (this.isKeySayingArray(key)) {
                                values[k] = [
                                    ...(values[k] ?? []),
                                    result.data
                                ];
                            } else {
                                values[k] = result.data;
                            }
                        }
                    }
                    first = false;
                    ++i;
                } else {
                    if (first) {
                        return {
                            matched: false
                        };
                    } else {
                        this.error(result, tokenStream);
                    }
                }
            }
            return {
                matched: true,
                skip: false,
                data: this.convertFunction(values),
                key
            };
        };
    }

    run(key: string, tokenStream: TokenStream) {
        return this.toSegment(key)(tokenStream);
    }

}

export class Parser {
    constructor(private entrypoint: CodeParser) {}

    parse(tokenStream: TokenStream) {
        const result = this.entrypoint.run('asdf', tokenStream);
        if (!result.matched || !('data' in result)) {
            throw new Error(`Compilation failed`);
        }
        return result.data;
    }
}