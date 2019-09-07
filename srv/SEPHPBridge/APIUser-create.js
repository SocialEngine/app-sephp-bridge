const app = require('app');

module.exports = async function (user) {
    if (app.isCli()) {
        console.log('IS CLI, SKIP');
        return;
    }
    const params = {
        ...user.asJSON(),
        email: user.getEmail()
    };
    const legacyId = await app.module.request('POST', '/bridge/api/users', params).catch(() => false);
    await app.module.migration.set('users', 'reverse:' + legacyId, user.id);
    await app.module.migration.set('users', 'data:' + user.id, JSON.stringify({
        user_id: legacyId
    }));
};
