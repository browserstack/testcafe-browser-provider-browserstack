import BaseLogHandler from './baseTemplate';

class NavigateURLHandler extends BaseLogHandler {
    constructor (data) {
        super('NAVIGATE_TO', data);
    }

    handleLog () {
        const { url = '' } = this.data;

        return { type: this.type, data: url };
    }
}

export default NavigateURLHandler;
