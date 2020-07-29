import { TokenStream, Token, TokenValue } from "../tokenstream";
import { Segment } from "./segment";
import { Result } from "./result";
import { Segments } from "./segments";

export type ResolveableSegment = Segment | string;

export class SegmentSequence extends Segment {
    private segments: Segment[] = [];
    private astType: string;

    private lastSegment: Segment = this;

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
            if (this.astType) {
                result.setType(this.astType);
            }
            for (const segment of this.segments) {
                if (!segment.key && !segment.flattened()) {
                    // debugger;
                }
                const segmentResult = segment.run(tokenStream, result);
                if (!segmentResult.matched()) {
                    return segmentResult.setFailInfo(null, result);
                }
                else if (segmentResult.hasData()) {
                    if (this.segments.length === 1) {
                        result.setFlatten(true);
                    }
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

    expectOneOf(type: string, values: TokenValue[]) {
        this.parse(Segments.expectOneOf(type, values));
        return this;
    }

    optional(parser: ResolveableSegment) {
        this.parse(new Segment((tokenStream, context) => {
            parser = this.resolveSegment(parser);
            const result = parser.run(tokenStream);
            if (!result.matched()) {
                return new Result(tokenStream).setMatch(true);
            }
            return result.setFlatten(true);
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

    static resolveSegment(segment: ResolveableSegment): Segment {
        if (!segment) {
             throw new Error(`Parser is not defined`);
        } else if (typeof(segment) === 'string') {
            return new Segment((tokenStream, context, data) => {
                const newParser = this.getRegisteredParser(segment);
                if (!newParser) {
                    throw new Error(`Parser with name '${segment}' doesn't exist`);
                }
                newParser.resetLast().setFlatten(context.flattened()).setKey(context.key);
                return newParser.run(tokenStream, data);
            });
        } else {
            // TODO: Is it correct to register it here?

            // this.register(parser);
        }
        return segment;
    }

    resetLast() {
        // FIXME
        // this.lastSegment = this;
        return this;
    }

    resolveSegment(segment: ResolveableSegment) {
        return SegmentSequence.resolveSegment(segment);
    }

    parse(segment: ResolveableSegment) {
        let resolvedSegment;
        if (typeof(segment) === 'string') {
            resolvedSegment = this.resolveSegment(segment).flatten(this.flattened());
        } else {
            resolvedSegment = segment;
        }
        this.segments.push(resolvedSegment);
        this.lastSegment = resolvedSegment;
        
        return this;
    }

    debug(message: string) {
        this.parse(new Segment((tokenStream) => (console.log(message), new Result(tokenStream).setMatch(true))))
        return this;
    }

    breakpoint() {
        this.parse(new Segment((tokenStream) => {
            debugger;
            return new Result(tokenStream).setMatch(true);
        }));
        return this;
    }

    add(key: string, value: any) {
        this.parse(new Segment((tokenStream) => {
            return new Result(tokenStream)
                .setKey(key)
                .setData(value)
                .setMatch(true);
        }));
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
                const result = segment.run(tokenStream).setKey(this.key);
                if (result.matched()) {
                    return result.setFlatten(true);
                } else {
                    const progress = result.progress;
                    if (progress > 0 && bestProgress < progress) {
                        bestProgress = progress;
                        bestResult = result;
                    }
                }
            }
            return bestResult ?? new Result(tokenStream).setMatch(false);
        }, `.oneOf(${parsers.map(parser => (parser as any).name ?? parser).join(', ')})`));
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
        this.parse(Segments.untilEOF(this.resolveSegment(parser)));
        return this;
    }

    until(end: Segment, parser: ResolveableSegment) {
        this.parse(Segments.until(end, this.resolveSegment(parser)));
        return this;
    }

    between(from: Segment, to: Segment, parser: ResolveableSegment) {
        this.parse(Segments.between(from, to, this.resolveSegment(parser)));
        return this;
    }

    whileWorking(parser: ResolveableSegment) {
        this.parse(this.resolveSegment(parser));
        return this;
    }

    doIf(condition: ResolveableSegment, then: ResolveableSegment) {
        this.parse(Segments.doIf(this.resolveSegment(condition), this.resolveSegment(then)));
        return this;
    }

    continueIfType(type: string, then: ResolveableSegment) {
        this.parse(Segments.doIfType(type, this.resolveSegment(then)));
        return this;
    }

    skip() {
        this.parse(Segments.skip());
        return this;
    }

    setKey(key: string) {
        super.as(key);
        return this;
    }

    setFlatten(flatten = true) {
        super.flatten(flatten);
        return this;
    }

    flatten(flatten = true): this {
        if (this.lastSegment === this) {
            this.setFlatten(flatten);
        } else {
            this.lastSegment.flatten(flatten);
        }
        return this;
    }

    as(key: string): this {
        console.log(`as(${key})`);
        if (this.lastSegment === this) {
            this.setKey(key);
        } else {
            this.lastSegment.as(key);
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