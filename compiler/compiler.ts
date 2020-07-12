import { InputStream } from "./inputstream";
import { TokenStream } from './tokenstream';
import { TokenLayout, TokenPattern } from './tokenstream';
import { SegmentSequence } from './parser/segment-sequence';
import { Segments } from "./parser/segments";
import { Segment } from "./parser/segment";
import { Parser } from "./parser/parser";

function name(key: string): Segment {
    return Segments.expectType('identifier').as(key);
}

function punctuation(value: string): Segment {
    return Segments.expect('punctuation', value);
}

function operator(value: string): Segment {
    return Segments.expect('operator', value);
}


const entrypoint = new SegmentSequence('entrypoint')
    
    .register(new SegmentSequence('condition')
        .delimitted(punctuation('('), punctuation(')'), Segments.doesntMatter(), 'expression')
    )
    .register(new SegmentSequence('if')
        .expect('keyword', 'if')
        .parse('condition').as('condition')
        .parse('atom').as('body')
    )

    .register(new SegmentSequence('value')
        .oneOf(
            new SegmentSequence('number').expectType('number').as('number'),
            new SegmentSequence('string').expectType('string').as('string')
        ).as('value')
    )

    .register(new SegmentSequence('argument')
        .expectType('identifier').as('name')
        .optional(new SegmentSequence()
            .expect('operator', '=')
            .parse('value').as('default')
        )
    )

    .register(new SegmentSequence('arguments')
        .delimitted(punctuation('('), punctuation(')'), punctuation(','), 'argument')
    )

    .register(new SegmentSequence('function')
        .expect('keyword', 'function')
        .expectType('identifier').as('name')
        .parse('arguments').as('arguments')
        .parse('codeblock').as('body')
    )

    .register(new SegmentSequence('let')
        .expect('keyword', 'let')
        .segment(name('name'))
        .optional(new SegmentSequence()
            .segment(operator('='))
            .parse('value').as('init')
        )
        .expect('punctuation', ';')
    )

    .register(new SegmentSequence('expression')
        .segment(Segments.dont())
    )

    .register(new SegmentSequence('atom')
        .oneOf('if', 'function', 'codeblock', 'let')
    )

    .register(new SegmentSequence('codeblock')
        .segment(punctuation('{'))
        .until(punctuation('}'), 'atom').as('body')
    )

    // start
    // .untilEOF('untilEof', new SegmentSequence()
    //     .join(null,
    //         'atom',
    //         new SegmentSequence()
    //             .segment(Segments.debugSkip())
    //             // .segment(Segments.fail('Nothing applied'))
    //     )
    // )
    // .untilEOF('untilEof', 'atom');
    .parse('atom').as('result');



function compile(code: string) {
    const inputStream = new InputStream(code);
    const tokenStream = new TokenStream(inputStream, [
        new TokenLayout('whitespace', [
            TokenPattern.RegEx(/^[\s\n]+/)
        ]),
        new TokenLayout('comment', [
            TokenPattern.Between('//', '\n'),
            TokenPattern.Between('/*', '*/')
        ]),
        new TokenLayout('string', [
            TokenPattern.Between('"', '"', '\\'),
            TokenPattern.Between("'", "'", '\\')
        ]),
        new TokenLayout('number', [
            TokenPattern.RegEx(/^-?\d+\.?\d*|^-?\d*\.?\d+/),
        ], num => parseFloat(num)),
        new TokenLayout('entity', [
            TokenPattern.RegEx(/^\@/),
        ], entity => entity.slice(1)),
        // new TokenLayout('relativePosition', [
        //     TokenPattern.OneOf("~"),
        // ]),
        new TokenLayout('keyword', [
            TokenPattern.OneOfEntry([ 'let', 'const', 'listen', 'event', 'if', 'else', 'true', 'false', 'function', 'class', 'for', 'forEach', 'function' ]),
        ]),
        new TokenLayout('identifier', [
            TokenPattern.RegEx(/^[a-zA-Z_]\w*/),
        ]),
        new TokenLayout('punctuation', [
            TokenPattern.OneOf(",;(){}[]"),
        ]),
        new TokenLayout('operator', [
            TokenPattern.OneOfEntry([ '+', '-', '*', '/', '%', '=', '+=', '-=', '/=', '*=', '%=', '<', '>', '>=', '<=', '==', '!=', '&&', '||', '=>' ]),
        ]),
    ], ['whitespace', 'comment']);

    const parser = new Parser(entrypoint);
    const ast = parser.parse(tokenStream);
    console.log(`######################## Result ###########`)
    console.log(JSON.stringify(ast, null, 2));

}

// compile(`
// function test(asdf, blub) {
//     const foo = "bar\\"asdf";
// }

// // relative positions aren't implemented yet
// const location = Location(1, 1, 1);

// // should that get implemented?
// const fn = () => {
//     say("hi");
// };
// `);

compile(`
function test(firstArg = 5, secondArg) {
    let foo = 'bar';
}
`)