import { TokenStreamCheckpoint } from '../tokenstream';


export class Reference {
    constructor(public from: TokenStreamCheckpoint,
                public to: TokenStreamCheckpoint) { }
}