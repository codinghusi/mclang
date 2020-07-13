import { TokenStream } from "../tokenstream";
import { ResolveableSegment, SegmentSequence } from './segment-sequence';

export class Result {
    private _matched = false;
    private _hasData = false;
    private _data: any = {};
    public progress: number;
    public failMessage: string;
    public failData: any;
    public key: string;
    public type: string;
    public progressMessage: string;

    constructor(private tokenStream: TokenStream) { }

    get data() {
        if (this.matched()) {
            return this._data;
        }
        return null;
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
        this._data = {
            type: this.type,
            ...this._data
        };
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
        Object.assign(this._data, data);
        this._hasData = true;
        return this;
    }

    addResult(result: Result) {
        if (result.hasData()) {
            if (result.key) {
                this.add(result.key, result.data);
            } else {
               this.addData(result.data);
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