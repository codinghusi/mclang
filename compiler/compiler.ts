import { InputStream } from "./inputstream";
import { TokenStream } from './lexer';
import { TokenLayout, TokenPattern } from './lexer';

function compile(code: string) {
    const inputStream = new InputStream(code);
    const lexer = new TokenStream(inputStream, [
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

    const result = [];
    while (!lexer.eof()) {
        const next = lexer.next();
        console.log(next);
        result.push(next);
    }
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