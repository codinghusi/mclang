import { InputStream } from "./inputstream";
import { TokenStream, Token } from './tokenstream';
import { TokenLayout, TokenPattern } from './tokenstream';
import { SegmentSequence } from './parser/segment-sequence';
import { Segments } from "./parser/segments";
import { Segment } from "./parser/segment";
import { Parser } from "./parser/parser";
import { Result } from "./parser/result";

import * as fs from 'fs';

const TWO_HAND_OPERATORS = [
    ['=', '+=', '-=', '/=', '*=', '%='],
    ['||'],
    ['&&'],
    ['<', '>', '<=', '>=', '==', '!='],
    ['+', '-'],
    ['*', '/', '%']
];

const PRE_OPERATORS = [
    '+', '-', '++', '--',
    '!', '~'
];

const POST_OPERATORS = [
    '++', '--'
];

const KEYWORDS = [ 'let', 'const', 'listen', 'event', 'if', 'else', 'true', 'false', 'function', 'class', 'for', 'forEach', 'function', 'new' ];

function precendence(operator: string) {
    return TWO_HAND_OPERATORS.findIndex(ops => ops.includes(operator));
}

function next_operation(firstPrecendence: number, left: any): Segment {
    return new Segment((tokenStream) => {
        
        const result = new Result(tokenStream);

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
        .expect('punctuation', '(')
        .parse('expression')
        .expect('punctuation', ')')
    )
    .register(new SegmentSequence('if')
        .expect('keyword', 'if')
        .parse('condition').as('condition')
        .parse('command').as('then')
        .optional(new SegmentSequence()
            .expect('keyword', 'else')
            .parse('command').as('else')
        )
    )

    .register(
        new SegmentSequence('functionCall')
            .delimitted(punctuation('('), punctuation(')'), punctuation(','), 'expression').as('parameters')
    )

    .register(
        new SegmentSequence('arrayAccessor')
            .expect('punctuation', '[')
            .parse('expression').as('index')
            .expect('punctuation', ']')
    )

    .register(new SegmentSequence('accessors')
        .whileWorking(new SegmentSequence()
            .oneOf(
                SegmentSequence.resolveSegment('functionCall').as('call'),
                SegmentSequence.resolveSegment('arrayAccessor').as('index')
            )
        ).flatten()
    )

    .register(new SegmentSequence('chainable')
        .expectType('identifier').as('key')
        .optional('accessors').as('accessors')
        .optional(new SegmentSequence()
            .expect('punctuation', '.')
            .parse('chainable').as('chain')
        )
    )

    .register(new SegmentSequence('expression')
        .oneOf(
            'instanciation',
            'operation',
            'value',
            new SegmentSequence()
                .between(punctuation('('), punctuation(')'), 'expression').flatten(),
            'function'
        ).as('base')
        .optional('accessors').as('accessors')
        .optional(new SegmentSequence()
            .expect('punctuation', '.')
            .parse('chainable').as('chain')
        )
    )

    .register(new SegmentSequence('operation')
        .parse('value').as('left')
        .parse(new Segment((tokenStream, context, result) => {
            const left = result.data.left;
            const operation = next_operation(-1, left).run(tokenStream);
            if (!operation.data || !('right' in operation.data)) {
                return new Result(tokenStream).setMatch(false);
            }
            return operation;
        })).flatten()
    )

    .register(new SegmentSequence('map')
        .delimitted(punctuation('{'), punctuation('}'), punctuation(','), new SegmentSequence()
            .expectType('identifier').as('key')
            .expect('punctuation', ':')
            .parse('expression').as('value')
        ).as('entries')
    )

    .register(new SegmentSequence('array')
        .delimitted(punctuation('['), punctuation(']'), punctuation(','), 'expression')
    )

    .register(new SegmentSequence('value')
        .oneOf(new SegmentSequence()
            .optional(
                Segments.expectOneOf('operator', PRE_OPERATORS).as('preOperator')
            )
            .oneOf(
                new SegmentSequence()
                    .expectType('number').as('value')
                    .add('valuetype', 'number'),
                new SegmentSequence()
                    .expectType('string').as('value')
                    .add('valuetype', 'string'),
                new SegmentSequence()
                    .expectOneOf('keyword', ['true', 'false']).as('value')
                    .add('valuetype', 'boolean'),
                new SegmentSequence()
                    .expectType('identifier').as('value')
                    .add('valuetype', 'variable'),
                
            )
            .optional(
                Segments.expectOneOf('operator', POST_OPERATORS).as('postOperator')
            ),

            new SegmentSequence()
                .parse('map').as('value')
                .add('valuetype', 'map'),
            new SegmentSequence()
                .parse('array').as('value')
                .add('valuetype', 'array'),
        )
    )

    .register(new SegmentSequence('argument')
        .expectType('identifier').as('name')
        .debug('argument name')
        .optional(new SegmentSequence()
            .expect('operator', '=')
            .parse('expression').as('default')
        )
    )

    .register(new SegmentSequence('arguments')
        .noType()
        .delimitted(punctuation('('), punctuation(')'), punctuation(','), 'argument')
    )

    .register(new SegmentSequence('functionBody')
        .expectType('identifier').as('name')
        .parse('arguments').as('arguments')
        .parse('codeblock').as('body')
    )

    .register(new SegmentSequence('function')
        .expect('keyword', 'function')
        .parse('functionBody').flatten()
    )

    .register(new SegmentSequence('declarationBody')
        .expectType('identifier').as('name')
        .optional(new SegmentSequence()
            .expect('punctuation', '.')
            .expectType('identifier').as('accessedKey')
        )
        .optional(new SegmentSequence()
            .parse(operator('='))
            .parse('expression').as('init')
        )
    )

    .register(new SegmentSequence('let')
        .expect('keyword', 'let')
        .parse('declarationBody').as('variable')
    )

    .register(new SegmentSequence('const')
        .expect('keyword', 'const')
        .parse('declarationBody').as('variable')
    )

    .register(new SegmentSequence('class')
        .expect('keyword', 'class')
        .expectType('identifier').as('name')
        .between(punctuation('{'), punctuation('}'), new SegmentSequence()
            .oneOf(
                'functionBody',
                new SegmentSequence()
                    .parse('declarationBody').flatten()
                    .expect('punctuation', ';')
            )
        ).as('body')
    )

    .register(new SegmentSequence('instanciation')
        .expect('keyword', 'new')
        .expectType('identifier').as('class')
        .parse('functionCall').as('call')
    )


    .register(new SegmentSequence('command')
        .oneOf(
            new SegmentSequence()
                .oneOf('if', 'function', 'class', 'codeblock'),
            new SegmentSequence()
                .oneOf('let', 'const', 'expression')
                .expect('punctuation', ';')
        )
    )

    .register(new SegmentSequence('codeblock')
        .between(punctuation('{'), punctuation('}'), 'command').as('commands')
    )

    // start
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
        ], token => (token.value = parseFloat(token.value.toString()), token)),
        // new TokenLayout('relativePosition', [
        //     TokenPattern.OneOf("~"),
        // ]),
        new TokenLayout('identifier', [
            TokenPattern.RegEx(/^[a-zA-Z_]\w*/),
        ], (token) => {
            if (KEYWORDS.includes(token.value.toString())) {
                token.type = 'keyword';
            }
            return token;
        }),
        new TokenLayout('punctuation', [
            TokenPattern.OneOf(".,:;(){}[]"),
        ]),
        new TokenLayout('operator', [
            TokenPattern.OneOfEntry([].concat(...TWO_HAND_OPERATORS, ...PRE_OPERATORS, ...POST_OPERATORS)),
        ]),
    ], ['whitespace', 'comment']);

    const parser = new Parser(entrypoint);
    try{
        const ast = parser.parse(tokenStream);
        fs.writeFile('output.json', JSON.stringify(ast, null, 2), (err: any) => {if (err) console.error(err)});
    } catch(e) {
        console.error(e);
    }
    // console.log(`######################## Result ###########`)
    // console.log(JSON.stringify(ast, null, 2));


}

compile(`
function test(asdf, blub) {
    const foo = "bar\\"asdf";
}

// relative positions aren't implemented yet
const location = Location(1, 1, 1);

// should that get implemented?
const fn = () => {
    say("hi");
};
`);

compile(`
class Location {
    lol = 'yolo';

    constructor(asdf = 1, lol = 2) {
        const foo = 'bar';
        blub = one().two.three().four;
    }

    foo() {

    }
}

function test(firstArg = 5, secondArg = "hi") {
    const entity = '@asdf'; // entities not working yet
    let entity.var = 1 * 2 + -3 * 4 + 10;

    if (!true && foo-- > 3) {
        log('working!');
    }

    const location = new Location(~1, ~-1, ~5);
}

const theMap = {
    foo: 'bar'
};
`)

// compile(`
// const foo = 'bar';
// `)