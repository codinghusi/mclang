import { Segment } from './segment';
import { Result } from './result';
import { SegmentSequence, ResolveableSegment } from './segment-sequence';
import { TokenValue } from '../tokenstream';

// TODO: make some interfaces for all AST Nodes

export const Segments = {
    expect(type: string, value: string): Segment {
        return new Segment((tokenStream) => {
            const token = tokenStream.next();
            const failMessage = `Expected ${type} ${value} but got ${token.type} ${token.value}`;
            const matched = token.value === value && token.type === type;

            return new Result(tokenStream)
                .setMatch(matched)
                .setFailInfo(failMessage)
                // .setData(token.value)
        }, `.expect('${type}', '${value}')`);
    },
    expectType(type: string): Segment {
        return new Segment((tokenStream, context) => {
            const token = tokenStream.next();
            const failMessage = `Expected ${type} but got ${token.type} ${token.value}`;
            const matched = token.type === type;

            return new Result(tokenStream)
                .setMatch(matched)
                .setFailInfo(failMessage)
                .setData(token.value)
        }, `.expectType('${type}')`);
    },
    expectOneOf(type: string, values: TokenValue[]) {
        return new Segment((tokenStream) => {
            const token = tokenStream.next();
            const failMessage = `Expected one of ${values} of type ${type} but got ${token.type} ${token.value}`;
            const matched = token.type === type && values.includes(token.value);

            return new Result(tokenStream)
                .setMatch(matched)
                .setFailInfo(failMessage)
                .setData(token.value)
        }, `.expectOneOf('${type}', '[${values}]')`);
    },
    maybe(type: string, value: string): Segment {
        return new Segment((tokenStream) => {
            const token = tokenStream.peek();
            const skip = token.value === value && token.type === type;
            const matched = true;

            if (skip) {
                tokenStream.next();
            }

            return new Result(tokenStream)
                .setMatch(matched)
                .setData(token.value)
        });
    },
    doIf(condition: Segment, then: Segment): Segment {
        return new Segment((tokenStream) => {
            const checkpoint = tokenStream.checkpoint();
            const result = condition.run(tokenStream);
            checkpoint.revert();
            if (result.matched()) {
                return then.run(tokenStream);
            }
            return new Result(tokenStream).setMatch(true);
        });
    },
    skip() {
        return new Segment((tokenStream) => {
            tokenStream.next();
            return new Result(tokenStream).setMatch(true)
        });
    },
    doIfType(type: string, then: Segment) {
        return Segments.doIf(Segments.expectType(type), then);
    },
    doesntMatter(): Segment {
        return new Segment((tokenStream) => new Result(tokenStream).setMatch(true));
    },
    dont(): Segment {
        return new Segment((tokenStream) => new Result(tokenStream).setMatch(false));
    },
    fail(message: string): Segment {
        return new Segment((tokenStream) => new Result(tokenStream).setMatch(false).setFailInfo(message));
    },
    debugSkip(): Segment {
        return new Segment((tokenStream) => new Result(tokenStream).setMatch(false));
    },
    until(end: Segment, parser: Segment): Segment {
        return Segments.delimitted(Segments.doesntMatter(), end, Segments.doesntMatter(), parser);
    },
    between(start: Segment, end: Segment, parser: Segment): Segment {
        return Segments.delimitted(start, end, Segments.doesntMatter(), parser);
    },
    untilEOF(parser: Segment): Segment {
        return new Segment((tokenStream) => {
            const result = new Result(tokenStream).setMatch(true);
            const values = [];
            while (!tokenStream.eof()) {
                const parserResult = parser.run(tokenStream).setFlatten();
                if (!parserResult.matched()) {
                    return parserResult;
                }
                if (parserResult.hasData()) {
                    values.push(parserResult.data);
                }
            }
            return result.setData(values);
        });
    },
    whileWorking(parser: Segment): Segment {
        return new Segment((tokenStream) => {
            const result = new Result(tokenStream).setMatch(true);
            const values = [];
            while (!tokenStream.eof()) {
                const parserResult = parser.run(tokenStream).setFlatten();
                if (!parserResult.matched()) {
                    return result;
                }
                if (parserResult.hasData()) {
                    values.push(parserResult.data);
                }
            }
            return result.setData(values);
        });
    },
    delimitted(from: Segment, to: Segment, seperator: Segment, parser: ResolveableSegment): Segment {
        return new Segment((tokenStream) => {
            const values = [];
            const result = new Result(tokenStream).setMatch(true);

            const fromResult = from.run(tokenStream);
            if (!fromResult.matched()) {
                return fromResult;
            }

            while (!to.run(tokenStream).matched()) {
                const parserResult = SegmentSequence.resolveSegment(parser).run(tokenStream).setFlatten();
                if (!parserResult.matched()) {
                    return result;
                }

                if (parserResult.hasData()) {
                    values.push(parserResult.data);
                }

                if (!seperator.run(tokenStream).matched()) {
                    const toResult = to.run(tokenStream);
                    if (!toResult.matched()) {
                        return toResult;
                    }
                    break;
                }
            }
            console.log('delimitted', values);
            return result.setData(values);
        });
        // }, `.delmitted('${key}', ${from.debuggingCode}, ${to.debuggingCode}, ${seperator.debuggingCode}, ${parser})`);
    }
}