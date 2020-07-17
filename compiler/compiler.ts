import { InputStream } from "./inputstream";
import { TokenStream, Token } from './tokenstream';
import { TokenLayout, TokenPattern } from './tokenstream';
import { SegmentSequence } from './parser/segment-sequence';
import { Segments } from "./parser/segments";
import { Segment } from "./parser/segment";
import { Parser } from "./parser/parser";
import { Result } from "./parser/result";

import * as fs from 'fs';

const OPERATORS = [
    ['=', '+=', '-=', '/=', '*=', '%='],
    ['||'],
    ['&&'],
    ['<', '>', '<=', '>=', '==', '!='],
    ['+', '-'],
    ['*', '/', '%']
];

function precendence(operator: string) {
    return OPERATORS.findIndex(ops => ops.includes(operator));
}

function next_operation(firstPrecendence: number, left: any): Segment {
    return new Segment((tokenStream) => {
        
        const result = new Result(tokenStream);
        console.log(`next_operation(prec: ${firstPrecendence}, left: ${JSON.stringify(left)})`);

        const operatorToken = tokenStream.peek();
        if (operatorToken.type === 'operator') {
            const secondPrecendence = precendence(operatorToken.value as string);
            
            if (firstPrecendence < secondPrecendence) {
                tokenStream.next();
                const rightValueResult = SegmentSequence.resolveSegment('expression').run(tokenStream);
                if (!rightValueResult.matched()) {
                    return rightValueResult.setFailInfo(null, result);
                }
                const rightToken = rightValueResult.data;

                const rightResult = next_operation(
                    secondPrecendence,
                    rightToken as Token
                ).run(tokenStream);
                if (!rightResult.matched()) {
                    return rightResult.setFailInfo(null, result);
                }   
                const right = rightResult.data;

                const data = {
                    type: 'operation',
                    operator: operatorToken,
                    left,
                    right
                };
                return next_operation(firstPrecendence, data).run(tokenStream);
            }
        }
        return result.setData(left).setMatch(true);
    });
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
        .parse('command').as('execution')
    )

    // FIXME: there comes no type for expression
    .register(new SegmentSequence('expression')
        .oneOf(
            'operation',
            'value',
            new SegmentSequence()
                .between(punctuation('('), punctuation(')'), 'expression'),
            'function'
        )
        .optional(new SegmentSequence('function_call')
            .delimitted(punctuation('('), punctuation(')'), punctuation(','), new SegmentSequence('parameter')
                .parse('expression').as('value')
            ).as('parameters')
        ).as('function_call')
    )

    .register(new SegmentSequence('operation')
        .parse('value').as('left')
        .parse(new Segment((tokenStream, context, result) => {
            const left = result.data.left;
            const operation = next_operation(-1, left).run(tokenStream);
            if (!('right' in operation.data)) {
                return new Result(tokenStream).setMatch(false);
            }
            return operation;
        }))
    )
    .register(new SegmentSequence('value')
        .oneOf(
            new SegmentSequence()
                .expectType('number').as('value')
                .add('valuetype', 'number'),
            new SegmentSequence()
                .expectType('string').as('value')
                .add('valuetype', 'string'),
            new SegmentSequence()
                .expectType('identifier').as('value')
                .add('valuetype', 'variable'),
        )
    )

    .register(new SegmentSequence('argument')
        .expectType('identifier').as('name')
        .optional(new SegmentSequence()
            .expect('operator', '=')
            .parse('expression').as('default')
        )
    )

    .register(new SegmentSequence('arguments')
        .noType()
        .delimitted(punctuation('('), punctuation(')'), punctuation(','), 'argument').as('arguments')
    )

    .register(new SegmentSequence('function')
        .expect('keyword', 'function')
        .expectType('identifier').as('name')
        .parse('arguments')
        .parse('codeblock').as('body')
    )

    .register(new SegmentSequence('let')
        .expect('keyword', 'let')
        .expectType('identifier').as('name')
        .optional(new SegmentSequence()
            .parse(operator('='))
            .parse('expression').as('init')
        )
        .expect('punctuation', ';')
    )

    .register(new SegmentSequence('command')
        .oneOf('if', 'function', 'codeblock', 'let', 'expression')
    )

    .register(new SegmentSequence('codeblock')
        .between(punctuation('{'), punctuation('}'), 'command').as('commands')
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
    // .parse('command').as('ast');
    .untilEOF('command').as('ast');



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
            TokenPattern.OneOfEntry([].concat(...OPERATORS)),
        ]),
    ], ['whitespace', 'comment']);

    const parser = new Parser(entrypoint);
    const ast = parser.parse(tokenStream);
    console.log(`######################## Result ###########`)
    console.log(JSON.stringify(ast, null, 2));

    fs.writeFile('output.json', JSON.stringify(ast, null, 2), (err: any) => {if (err) console.error(err)});

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
function test(firstArg = 5, secondArg = "hi") {
    let foo = 1 * 2 + 3 * 4 + 10;
}
`)