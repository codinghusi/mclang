import { TokenStream } from "../tokenstream";
import { SegmentSequence } from "./segment-sequence";

export class Parser {
    constructor(private entrypoint: SegmentSequence) {}

    parse(tokenStream: TokenStream) {
        const result = this.entrypoint.run(tokenStream);
        if (!result.hasData()) {
            // Throw error
            const token = tokenStream.peek();
            const prefix = `Problem with line ${token.line}:${token.column}: `;
            if (result.failMessage) {
                throw new Error(prefix + result.failMessage);
            } else { // ${JSON.stringify(result.failData)}
                throw new Error(prefix + `Unexpected ${token.type} ${token.value}`);
            }
        }
        return result.data;
    }
}