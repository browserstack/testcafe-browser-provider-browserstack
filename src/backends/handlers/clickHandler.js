import BaseLogHandler from './baseTemplate';

class ClickHandler extends BaseLogHandler {
    constructor (data) {
        super('CLICK', data);
    }

    handleLog () {
        const { selector: { apiFnChain: selectorApiFnChain = [] } } = this.data;

        // TODO: Need to be extended to other click commands that are
        // mentioned in playback/click
        return { type: this.type, data: selectorApiFnChain.join('') };
    }
}

export default ClickHandler;
