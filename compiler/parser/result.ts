import { TokenStream, Token, TokenStreamCheckpoint } from '../tokenstream';
import { ResolveableSegment, SegmentSequence } from './segment-sequence';
import { Reference } from "./reference";
import { InputStreamCheckpoint } from '../inputstream';
import { ParserDebugger } from './debugging';

export class Result {
    private _matched = false;
    private _hasData = false;
    private _data: any;
    private _flatten: boolean = null;
    public progress: number;
    public failMessage: string;
    public failData: any;
    public key: string = null;
    public type: string;
    public progressMessage: string;
    public reference: Reference;
    public position: InputStreamCheckpoint; 

    /* TODO: remove TokenStream from here */
    constructor(private tokenStream: TokenStream) { }

    get data() {
        if (!this.matched()) {
            return null;
        }
        let data = this._data;
        if (this.type && typeof(data) === 'object') {
            data = {
                type: this.type,
                ...this._data,
                reference: this.reference
            }
        }
        if (this.key) {
            return {
                [this.key]: data
            }
        }
        return data;
    }

    flattened() {
        return this._flatten;
    }

    setPosition(position: InputStreamCheckpoint) {
        this.position = position;
        return this;
    }

    setReference(reference: Reference) {
        this.reference = reference;
        return this;
    }

    setProgress(progress: number) {
        this.progress = progress;
        return this;
    }

    setMatch(hasMatch = true) {
        this._matched = hasMatch;
        return this;
    }

    setKey(key: string) {
        if (key) {
            if (this.key && this.key !== key) {
                console.log(`overwriting ${this.key} to ${key}`);
            }
            this.key = key;
        }
        if (key === 'init' && this.matched()) {
            // console.log('key init', this);
        }
        return this;
    }

    setType(type: string) {
        this.type = type;
        return this;
    }

    setFailInfo(message: string, additionalData?: any) {
        this.failMessage = message ?? this.failMessage;
        this.failData = additionalData ?? this.failData;
        return this;
    }

    setProgressMessage(message: string) {
        this.progressMessage = message;
        return this;
    }

    setFlatten(flatten = true) {
        if (flatten !== this._flatten) {
            // console.log('changed flatten', flatten, this.key, this.data);
        }
        this._flatten = flatten;
        return this;
    }

    add(key: string, value: any) {
        // Shorthand: if no key is provided it does nothing (So the content won't be in the result if not wanted)
        if (typeof(this._data) !== 'object') {
            // FIXME: maybe loss of data
            this._data = {};
        }
        if (key) {
            this._data[key] = value;
            this._hasData = true;
        }
        return this;
    }

    addToArray(key: string, value: any) {
        if (key) {
            let array = this._data[key] || [];
            this._data[key] = array;
            array.push(value);
            this._hasData = true;
        }
        return this;
    }

    setData(data: any) {
        this._data = data;
        this._hasData = true;
        return this;
    }

    addData(data: any) {
        if (!this._data) {
            this._data = {};
        }
        if (typeof(this._data) !== 'object') {
            this.setData(data);
            return this;
        }
        Object.assign(this._data, data);
        this._hasData = true;
        return this;
    }

    addResult(result: Result) {
        if (result.hasData() && (result.key || result.flattened())) {
            if (Array.isArray(result.data) || typeof(result.data) !== 'object') {
                this.setData(result.data);
            }
            else {
                this.addData(result.data);
            }
        } else {
            if (result.hasData()) {
                ParserDebugger.debug('data couldnt be added');
                console.warn('uhh data of result couldnt be added', result.key, result.flattened(), result.data, '\nto', this.key, this.data);
                // debugger;
            }
        }
        return this;
    }

    useParser(parser: ResolveableSegment) {
        parser = SegmentSequence.resolveSegment(parser);
        const result = parser.run(this.tokenStream);
        this.addResult(result);
        return result;
    }

    hasData() {
        return this._hasData && this.matched();
    }

    matched() {
        return this._matched;
    }
}