import { TokenStream } from "../tokenstream";
import { SegmentSequence } from "./segment-sequence";

export class Parser {
    constructor(private entrypoint: SegmentSequence) {}

    parse(tokenStream: TokenStream) {
        const result = this.entrypoint.run(tokenStream);
        if (!result.hasData()) {
            // Throw error
            const position = result.position;
            const prefix = `Problem with line ${position.line}:${position.column}: `;
            if (result.failMessage) {
                throw new Error(prefix + result.failMessage);
            } else { // ${JSON.stringify(result.failData)}
                const token = tokenStream.peek();
                throw new Error(prefix + `Unexpected ${token.type} ${token.value}`);
            }
        }
        return result.data;
    }
}