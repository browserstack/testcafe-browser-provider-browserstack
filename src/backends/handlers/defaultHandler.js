import BaseLogHandler from './baseTemplate';

class DefaultHandler extends BaseLogHandler {
    constructor (data) {
        super('GENERIC', data);
    }

    handleLog () {
        return {
            type: this.type,
            data: '',
        };
    }
}

export default DefaultHandler;
