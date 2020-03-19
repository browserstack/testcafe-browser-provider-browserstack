import BaseLogHandler from './baseTemplate';

class TypeTextHandler extends BaseLogHandler {
    constructor (data) {
        super('TYPE_TEXT', data);
    }

    handleLog () {
        const { text = '' } = this.data;

        return { type: this.type, data: text };
    }
}

export default TypeTextHandler;
