import BaseLogHandler from './baseTemplate';

class AssertHandler extends BaseLogHandler {
    constructor (data) {
        super('ASSERT_ELEMENT', data);
    }

    handleLog () {
        const { expected = '' } = this.data;

        return { type: this.type, data: expected };
    }
}

export default AssertHandler;
