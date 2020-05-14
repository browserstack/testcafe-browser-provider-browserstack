import BaseLogHandler from './baseTemplate';

class PressHandler extends BaseLogHandler {
    constructor (data) {
        super('KEY_PRESS', data);
    }

    handleLog () {
        const { keys = '' } = this.data;

        return { type: this.type, data: keys };
    }
}

export default PressHandler;

