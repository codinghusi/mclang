import { TokenStream, Token } from "../tokenstream";
import { ResolveableSegment, SegmentSequence } from './segment-sequence';
import { Reference } from "./reference";

export class Result {
    private _matched = false;
    private _hasData = false;
    private _data: any;
    public progress: number;
    public failMessage: string;
    public failData: any;
    public key: string;
    public type: string;
    public progressMessage: string;
    public reference: Reference;

    /* TODO: remove TokenStream from here */
    constructor(private tokenStream: TokenStream) { }

    get data() {
        if (this.matched()) {
            if (this.key) {
                if (this.type && typeof(this._data) === 'object') {
                    return {
                        [this.key]: {
                            type: this.type,
                            ...this._data,
                            reference: this.reference
                        }
                    }
                }
                return {
                    [this.key]: this._data
                }
            }
            return this._data;
        }
        return null;
    }

    private updateData() {
        this._data = {
            // type: this.type,
            ...this._data,
            // reference: this.reference
        };
        return this;
    }

    setReference(reference: Reference) {
        this.reference = reference;
        this.updateData();
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
        this.key = key;
        return this;
    }

    setType(type: string) {
        this.type = type;
        this.updateData();
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
        console.log(`set data: ${JSON.stringify(data, null, 2)}`);
        
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
        if (result.hasData()) {
            if (Array.isArray(result.data) || typeof(result.data) !== 'object') {
                this.setData(result.data);
            }
            else {
                this.addData(result.data);
            }
            // if (result.key) {
            //     this.add(result.key, result.data);
            // } else if (typeof(result.data) === 'object') {
            //     this.addData(result.data);
                // if (!this.reference && result.reference) {
                //     this.addData({
                //         ...result.data,
                //         reference: result.reference
                //     });
                // } else {
                //     this.addData(result.data);
                // }
            // }
            // else if (!Object.keys(this.data).length) {
            //     this._data = result.data;
            //     this._hasData = true;
            // }
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