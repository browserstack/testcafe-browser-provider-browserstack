function getNode(root) {
    const queue = [];

    queue.push(root);

    // This is needed so that this doesn't ran infinite as
    // there are heck lot of dependencies used in frameworks
    let MAX_DEPTH_LEVEL = 10;

    while (!(queue.length === 0) && MAX_DEPTH_LEVEL) {
        const queueLength = queue.length;

        for (let idx = 0; idx < queueLength; ++idx) {
            const elem = queue.shift();

            for (
                let childIdx = 0;
                childIdx < elem.children.length;
                ++childIdx
            ) {
                const childNode = elem.children[childIdx];

                if (childNode.exports) {
                    if (childNode.exports._getTestRunCtor) {
                        const origFn = childNode.exports._getTestRunCtor;

                        const proxyArgsToExecutor = async args => {
                            await this.sendArgsToBackend(args);
                        };

                        childNode.exports._getTestRunCtor = function(a, b) {
                            const value = origFn(a, b);
                            class psuedoTestRun {
                                constructor(...args) {
                                    this.adjust(args);
                                    return new value(...args);
                                }
                            }

                            psuedoTestRun.prototype.adjust = proxyArgsToExecutor;

                            Object.keys(value.prototype).forEach(key => {
                                psuedoTestRun.prototype[key] =
                                    value.prototype[key];
                            });

                            return psuedoTestRun;
                        };
                    }

                    if (childNode.exports._addEntry) return childNode;
                }

                queue.push(elem.children[childIdx]);
            }
        }

        --MAX_DEPTH_LEVEL;
    }
    return null;
};

export default getNode;
