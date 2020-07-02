import { InputStream } from "./inputstream";
import { TokenStream } from './lexer';

function compile(code: string) {
    const inputStream = new InputStream(code);
    const lexer = new TokenStream(inputStream);

    const result = [];
    while (!lexer.eof()) {
        const next = lexer.next();
        console.log(next);
        result.push(next);
    }
    // console.log(result);
}

compile(`
function test(asdf, blub) {
    const foo = "bar\\"asdf"
}
`);