import { TokenStream } from "../tokenstream";
import { Segment } from "./segment";
import { Result } from "./result";
import { Segments } from "./segments";

export type ResolveableSegment = Segment | string;

export class SegmentSequence extends Segment {
    private segments: Segment[] = [];
    private astType: string;

    private convertFunction = (raw: any) => {
        return raw;
    };

    static sequences: SegmentSequence[] = [];

    static register(parser: SegmentSequence) {
        this.sequences.push(parser);
    }

    constructor(public name?: string) {
        super((tokenStream) => {
            const result = new Result(tokenStream).setMatch(true);
            if (this.astType && !result.type) {
                result.setType(this.astType);
            }
            // let progressMessage = '';
            for (const segment of this.segments) {
                
                const segmentResult = segment.run(tokenStream);
                if (!segmentResult.matched()) {
                    return segmentResult.setFailInfo(null, result);
                }
                else if (segmentResult.hasData()) {
                    result.addResult(segmentResult);
                }
                if (segmentResult.progressMessage) {
                    // progressMessage += `${segmentResult.progressMessage}\n`;
                }
            }
            const data = this.convertFunction(result.data);
            result.setData(data);
            // FIXME: Having a loss of type (-information)
            return result;
                // .setProgressMessage(progressMessage);
        }, `Parser "${name ?? 'unnamed'}"`);
        // TODO: maybe register here
        this.type(name);
    }

    type(type: string) {
        this.astType = type;
        return this;
    }

    noType() {
        this.type(null);
        return this;
    }

    expect(type: string, value: string) {
        this.parse(Segments.expect(type, value));
        return this;
    }

    expectType(type: string) {
        this.parse(Segments.expectType(type));
        return this;
    }

    optional(parser: ResolveableSegment) {
        this.parse(new Segment(tokenStream => {
            parser = this.resolveSegment(parser);
            const result = parser.run(tokenStream);
            if (!result.matched()) {
                return new Result(tokenStream).setMatch(true);
            }
            return result;
        }));
        return this;
    }

    register(parser: SegmentSequence) {
        SegmentSequence.register(parser);
        return this;
    }

    static getRegisteredParser(name: string) {
        return SegmentSequence.sequences.find(segment => segment.name === name);
    }

    static resolveSegment(segment: ResolveableSegment) {
        if (!segment) {
             throw new Error(`Parser is not defined`);
        } else if (typeof(segment) === 'string') {
            const newParser = this.getRegisteredParser(segment);
            if (!newParser) {
                throw new Error(`Parser with name '${segment}' doesn't exist`);
            }
            return newParser;
        } else {
            // TODO: Is it correct to register it here?

            // this.register(parser);
        }
        return segment;
    }

    resolveSegment(segment: ResolveableSegment) {
        return SegmentSequence.resolveSegment(segment);
    }

    parse(segment: ResolveableSegment) {
        if (typeof(segment) === 'string') {
            this.segments.push(new Segment((tokenStream) => {
                return this.resolveSegment(segment).run(tokenStream);
            }));
        } else {
            this.segments.push(segment);
        }
        
        return this;
    }

    oneOf(...parsers: ResolveableSegment[]) {
        this.parse(new Segment(tokenStream => {
            // If fails get the best one for good error description
            let bestProgress = -1;
            let bestResult = null;
            
            // Resolve the string ones into segments
            const allSegments = parsers.map(segment => this.resolveSegment(segment));
            
            // Test all if one works
            for (const segment of allSegments) {
                const result = segment.run(tokenStream);
                const progress = result.progress;
                if (result.matched()) {
                    return result;
                } else {
                    if (progress > 0 && bestProgress < progress) {
                        bestProgress = progress;
                        bestResult = result;
                    }
                }
            }
            return bestResult ?? new Result(tokenStream).setMatch(false);
        }, `.oneOf(${parsers.join(', ')})`));
        return this;
    }

    delimitted(from: Segment, to: Segment, seperator: Segment, parser: ResolveableSegment) {
        this.parse(Segments.delimitted(from, to, seperator, parser));
        return this;
    }

    convert(convertFn: (raw: any) => any) {
        this.convertFunction = convertFn;
        return this;
    }

    untilEOF(parser: ResolveableSegment) {
        this.parse(new Segment(tokenStream => {
            parser = this.resolveSegment(parser);
            return Segments.untilEOF(parser).run(tokenStream);
        }));
        return this;
    }

    until(end: Segment, parser: ResolveableSegment) {
        this.parse(new Segment(tokenStream => {
            parser = this.resolveSegment(parser);
            return Segments.until(end, parser).run(tokenStream);
        }));
        return this;
    }

    as(key: string) {
        if (this.segments.length) {
            this.segments[this.segments.length - 1].as(key);
        }
        return this;
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

}