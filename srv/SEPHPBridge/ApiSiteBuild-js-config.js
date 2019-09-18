const app = require('app');

module.exports = async function (event) {
    event.config.sephp = {
        url: await app.data.get('sephp:url'),
        cdn: await app.setting('sephp:cdnUrl')
    }
};
