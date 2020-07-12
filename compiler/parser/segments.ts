import { Segment } from './segment';
import { Result } from './result';
import { SegmentSequence, ResolveableSegment } from './segment-sequence';

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
                .setProgressMessage(`got ${type} ${value}`);
        }, `.expect('${type}', '${value}')`);
    },
    expectType(type: string): Segment {
        return new Segment((tokenStream, context) => {
            const token = tokenStream.next();
            const failMessage = `Expected ${type} but got ${token.type}`;
            const matched = token.type === type;

            console.log('expectType key: ' + context.key);

            return new Result(tokenStream)
                .setMatch(matched)
                .setFailInfo(failMessage)
                .setProgressMessage(`got ${type} ${token.value} as ${context.key ?? 'unnamed'}`)
                .add(context.key, token);
        }, `.expectType('${type}')`);
    },
    maybe(type: string, value: string, key?: string): Segment {
        return new Segment((tokenStream) => {
            const token = tokenStream.peek();
            const skip = token.value === value && token.type === type;
            const matched = true;

            if (skip) {
                tokenStream.next();
            }

            return new Result(tokenStream)
                .setMatch(matched)
                .add(key, token);
        });
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
    untilEOF(parser: Segment): Segment {
        return new Segment((tokenStream, context) => {
            const result = new Result(tokenStream);
            while (!tokenStream.eof()) {
                const parserResult = parser.run(tokenStream);
                if (!parserResult.matched()) {
                    return parserResult;
                }
                if (parserResult.hasData()) {
                    result.addToArray(context.key, parserResult.data);
                }
            }
            return result.setMatch(true);
        });
    },
    delimitted(from: Segment, to: Segment, seperator: Segment, parser: ResolveableSegment): Segment {
        return new Segment((tokenStream) => {
            const result = new Result(tokenStream);

            const fromResult = from.run(tokenStream);
            if (!fromResult.matched()) {
                return fromResult;
            }

            while (!to.run(tokenStream).matched()) {
                const parserResult = result.useParser(SegmentSequence.resolveSegment(parser));
                if (!parserResult.matched()) {
                    return result;
                }

                if (parserResult.hasData()) {
                    result.addToArray(this._key, parserResult.data);
                }

                if (!seperator.run(tokenStream).matched()) {
                    const toResult = to.run(tokenStream);
                    if (!toResult.matched()) {
                        return toResult;
                    }
                    break;
                }
            }
            return result
                .setMatch(true)
                .setType(this.astType ?? undefined);
        });
        // }, `.delmitted('${key}', ${from.debuggingCode}, ${to.debuggingCode}, ${seperator.debuggingCode}, ${parser})`);
    }
}