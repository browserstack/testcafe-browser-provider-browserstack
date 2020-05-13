import {
    TypeTextHandler,
    DefaultHandler,
    AssertHandler,
    SelectorHandler,
    NavigateURLHandler,
    PressHandler,
} from './handlers';

const decideHandler = (type, data) => {
    switch (type) {
        case 'type-text':
            return new TypeTextHandler(data);
        case 'assertion':
            return new AssertHandler(data);
        case 'execute-selector':
            return new SelectorHandler(data);
        case 'navigate-to':
            return new NavigateURLHandler(data);
        case 'press':
            return new PressHandler(data);
        default:
            return new DefaultHandler(data);
    }
};

const parsePayload = data => {
    const { type = 'cmd' } = data;

    const handler = decideHandler(type, data);
    const logData = handler.handleLog();

    return { arguments: logData };
};

export default parsePayload;
