import { TokenStream } from '../tokenstream';
import { CodeSegment, Segments, Result } from './segments';

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
        return this;
    }

    expect(type: string, value: string) {
        this.segment(Segments.expect(type, value));
        return this;
    }

    expectType(key: string, type: string) {
        this.segment(Segments.expectType(key, type));
        return this;
    }

    maybe(parser: CodeParser | string) {
        this.segment(tokenStream => {
            parser = this.resolveParser(parser);
            const result = parser.run(null, tokenStream);
            if (!result.handle()) {
                return new Result(tokenStream).setMatch(true);
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
            
            const result = (parser as CodeParser).run(key, tokenStream);
            return result;
        });
        return this;
    }

    segment(segment: CodeSegment) {
        this.segments.push(segment);
        return this;
    }

    join(...parsers: (CodeSegment | CodeParser | string)[] ) {
        this.segment(tokenStream => {
            let bestProgress = -1;
            let bestResult = null;
            
            // Get all to the same type
            const parserNames = parsers.filter(parser => typeof(parser) === 'string') as string[];
            const segments = parsers.filter(parser => typeof(parser) === 'function') as CodeSegment[];
            const codeParsers = parsers.filter(parser => parser instanceof CodeParser) as CodeParser[];
            const allSegments = [
                ...parserNames
                    .map(name => this.resolveParser(name))
                    .concat(codeParsers)
                    .map(parser => parser.toSegment(null)),
                ...segments,
            ];
            
            // Test all if one works
            for (const segment of allSegments) {
                const result = segment(tokenStream);
                const progress = result.progress;
                if (result.handle()) {
                    return result;
                } else {
                    if (progress > 0 && bestProgress <= progress) {
                        bestProgress = progress;
                        bestResult = result;
                    }
                }
            }
            return bestResult ?? new Result(tokenStream).setMatch(false);
        });
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

    error(result: Result, tokenStream: TokenStream) {
        const token = tokenStream.peek();
        const prefix = `Problem with line ${token.line}:${token.column}: `;
        if (result.failMessage) {
            throw new Error(prefix + result.failMessage);
        } else {
            throw new Error(prefix + `Unexpected ${token.type} ${token.value}`);
        }
    }

    // TODO: please add comments to this mess
    toSegment(key: string): CodeSegment {
        return (tokenStream) => {
            const result = new Result(tokenStream);
            for (const segment of this.segments) {
                const segmentResult = segment(tokenStream);
                if (!segmentResult.handle()) {
                    return segmentResult;
                }
                else if (segmentResult.hasData()) {
                    result.addResult(segmentResult);
                }
            }
            const data = this.convertFunction(result.data);
            result.setData(data);
            // FIXME: Having a loss of type (-information)
            if (this.astType && !result.type) {
                result.setType(this.astType);
            }
            return result;
        };
    }

    run(key: string, tokenStream: TokenStream) {
        return this.toSegment(key)(tokenStream);
    }

}

export class Parser {
    constructor(private entrypoint: CodeParser) {}

    parse(tokenStream: TokenStream) {
        const result = this.entrypoint.run(null, tokenStream);
        const token = tokenStream.peek();
        const prefix = `Problem with line ${token.line}:${token.column}: `;
        
        if (!result.handle() || !result.hasData()) {
            if (result.failMessage) {
                throw new Error(prefix + result.failMessage);
            } else {
                throw new Error(prefix + `Unexpected ${token.type} ${token.value}`);
            }
        }
        return result.data;
    }
}