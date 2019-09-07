const app = require('app');

module.exports = async function (event) {
    let legacyUser = await app.data.get(
        'sephp:migration:users:data:' + event.user.id
    );
    if (legacyUser) {
        legacyUser = JSON.parse(legacyUser);
    }
    const response = await app.module.request('POST', '/bridge/api/login', {
        user_id: legacyUser.user_id,
        password: event.password
    });
    if (response.isValidPassword !== undefined && response.isValidPassword) {
        await app.api.users.updateInternal(event.user.id, {
            password: app.utility.hash.make(event.password)
        });
        event.pass = true;
    }
};
