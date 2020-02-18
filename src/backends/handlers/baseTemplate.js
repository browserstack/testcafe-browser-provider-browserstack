class BaseLogHandler {
    constructor (type, data) {
        this.type = type;
        this.data = data;
    }

    handleLog () {
        throw new Error('Method needs to be implemented');
    }
}

export default BaseLogHandler;
