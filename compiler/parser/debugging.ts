import * as fs from 'fs';


export class ParserDebugger {
    static tabs = 1;
    static first = true;

    static init() {
        if (!this.first) {
            return;
        }
        this.first = false;
        fs.writeFile('debugging.txt', '', () => {});
    }

    static debug(code: string) {
        this.init();
        const max = 40;
        let tabsStr = new Array(Math.min(max, Math.max(1, this.tabs))).fill('  ').join('').slice(1);
        if (tabsStr.length >= max) {
             tabsStr += '>>> ';
        }
        console.log(tabsStr + code);
        fs.appendFile('debugging.txt', tabsStr + code + '\n', () => {});
    }

    static indent() {
        this.tabs++;
    }

    static unindent() {
        this.tabs--;
    }
}