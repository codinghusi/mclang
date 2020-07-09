import { InputStream } from "./inputstream";
import { TokenStream } from './tokenstream';
import { TokenLayout, TokenPattern } from './tokenstream';
import { CodeParser, Parser } from './parser/parser';
import { CodeSegment, Segments } from "./parser/segments";

function name(key: string): CodeSegment {
    return Segments.expectType('identifier', key);
}

function punctuation(value: string): CodeSegment {
    return Segments.expect('punctuation', value);
}

function operator(value: string): CodeSegment {
    return Segments.expect('operator', value);
}


const entrypoint = new CodeParser('entrypoint')
    
    .register(new CodeParser('condition')
        .delimitted('condition', punctuation('('), punctuation(')'), Segments.doesntMatter(), 'expression')
    )
    .register(new CodeParser('if')
        .expect('identifier', 'if')
        .parse('condition', 'condition')
        .parse('body', 'atom')
    )

    .register(new CodeParser('value')
        .join(null,
            new CodeParser('number').expectType('value', 'number'),
            new CodeParser('string').expectType('value', 'string')
        )
    )

    .register(new CodeParser('argument')
        .expectType('name', 'identifier')
        .maybe(new CodeParser()
            .expect('operator', '=')
            .parse('default', 'value'))
    )

    .register(new CodeParser('arguments')
        .delimitted(null, punctuation('('), punctuation(')'), punctuation(','), 'argument')
    )

    .register(new CodeParser('function')
        .expect('identifier', 'function')
        .expectType('name', 'identifier')
        .parse('arguments', 'arguments')
        .parse('body', 'codeblock')
    )

    .register(new CodeParser('let')
        .expect('identifier', 'let')
        .segment(name('name'))
        .maybe(new CodeParser()
            .segment(operator('='))
            .parse('init', 'value'))
        .expect('punctuation', ';')
    )

    .register(new CodeParser('expression')
        .segment(Segments.dont())
    )

    .register(new CodeParser('atom')
        .join('if', 'function', 'codeblock', 'let'))

    .register(new CodeParser('codeblock')
        .segment(punctuation('{'))
        .until(null, punctuation('}'), 'atom')
    )

    // start
    // .untilEOF('untilEof', new CodeParser()
    //     .join(null,
    //         'atom',
    //         new CodeParser()
    //             .segment(Segments.debugSkip())
    //             // .segment(Segments.fail('Nothing applied'))
    //     )
    // )
    // .untilEOF('untilEof', 'atom');
    .parse(null, 'atom');



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