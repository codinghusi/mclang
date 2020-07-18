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
        let tabsStr = '  '.repeat(Math.min(max, this.tabs));
        if (this.tabs >= max) {
             tabsStr += '>>> ';
        }
        console.log(tabsStr + code);
        fs.appendFile('debugging.txt', tabsStr + code + '\n', (err) => {if (err) throw err;});
    }

    static indent() {
        this.tabs++;
    }

    static unindent() {
        this.tabs--;
    }
}