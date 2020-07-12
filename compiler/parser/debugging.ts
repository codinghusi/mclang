

export class ParserDebugger {
    static tabs = 1;

    static debug(code: string) {
        const max = 40;
        let tabsStr = new Array(Math.min(max, Math.max(1, this.tabs))).fill('  ').join('').slice(1);
        if (tabsStr.length >= max) {
             tabsStr += '>>> ';
        }
        console.log(tabsStr + code);
    }

    static indent() {
        this.tabs++;
    }

    static unindent() {
        this.tabs--;
    }
}