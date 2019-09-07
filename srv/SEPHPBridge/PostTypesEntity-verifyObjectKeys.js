const app = require('app');

module.exports = async function ({payload}) {
    if (payload.allowed !== undefined) {
        payload.allowed.push({
            key: 'legacy'
        });
    }
};