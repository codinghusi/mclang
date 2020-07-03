import { InputStream } from "./inputstream";
import { TokenStream } from './lexer';
import { TokenLayout, TokenPattern } from './lexer';
import { CodeParser, Parser } from './parser/parser';
import { CodeSegment, Segments } from "./parser/segments";

function keyword(name: string): CodeSegment {
    return (tokenStream: TokenStream) => {
        const token = tokenStream.peek();
        const matched = token.value === name && token.type === 'identifier';
        return {
            matched,
            skip: true,
        };
    }
}

function name(key: string): CodeSegment {
    return (tokenStream: TokenStream) => {
        const token = tokenStream.peek();
        const matched = token.type === 'identifier';
        return {
            matched,
            skip: true,
            data: [key, token.value]
        };
    }
}

function punctuation(value: string): CodeSegment {
    return (tokenStream: TokenStream) => {
        const token = tokenStream.peek();
        const matched = token.value === value && token.type === 'punctuation';
        return {
            matched,
            skip: true,
        };
    }
}

function maybe_punctuation(value: string): CodeSegment {
    return (tokenStream: TokenStream) => {
        const token = tokenStream.peek();
        const skip = token.value === value && token.type === 'punctuation';
        return {
            matched: true,
            skip
        };
    }
}


const entrypoint = new CodeParser('entrypoint')
    
    .register(new CodeParser('condition')
        .delimited('condition', Segments.expect(null, 'punctuation', '('), Segments.expect(null, 'punctuation', ')'), Segments.doesntMatter(), 'expression')
    )
    .register(new CodeParser('if')
        .expect(null, 'identifier', 'if')
        .parse('condition', 'condition')
        .parse('body', 'atom')
    )

    .register(new CodeParser('value')
        .join(null,
            new CodeParser().expectType(null, 'number'),
            new CodeParser().expectType(null, 'string')
        )
    )

    .register(new CodeParser('argument')
        .expectType('name', 'identifier')
        .maybe(new CodeParser()
            .expect(null, 'punctuation', '=')
            .parse('value', 'value'))
    )

    .register(new CodeParser('arguments')
        .delimited('arguments', Segments.expect(null, 'punctuation', '('), Segments.expect(null, 'punctuation', ')'), Segments.expect(null, 'punctuation', ','), 'argument')
    )

    .register(new CodeParser('function')
        .expect(null, 'identifier', 'function')
        .expectType('name', 'identifier')
        .parse('arguments', 'arguments')
        .parse('body', 'atom')
    )

    .register(new CodeParser('expression')
        .segment(Segments.dont())
    )

    .register(new CodeParser('atom')
        .join(null, 'if', 'function'))

    // start
    // .untilEOF('untilEof', new CodeParser()
    //     .join(null,
    //         'atom',
    //         new CodeParser()
    //             .segment(Segments.debugSkip())
    //             // .segment(Segments.fail('Nothing applied'))
    //     )
    // )
    .untilEOF('untilEof', 'atom');



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
    console.log(ast);
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
function test(firstArg, secondArg) {

}
`)