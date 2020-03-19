import BaseLogHandler from './baseTemplate';

class SelectorHandler extends BaseLogHandler {
    constructor (data) {
        super('FIND_ELEMENT', data);
    }

    handleLog () {
        const { apiFnChain = [] } = this.data;

        return {
            type: this.type,
            data: JSON.stringify(apiFnChain),
        };
    }
}

export default SelectorHandler;
