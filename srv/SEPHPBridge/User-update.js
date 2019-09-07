const app = require('app');

module.exports = async function (event) {
    if (app.isCli()) {
        console.log('IS CLI, SKIP');
        return;
    }
    if (event.user.type) {
        console.log('Not a normal user to update.');
        console.log('type:' + event.user.type, event.user.name);
        return null;
    }
    const user = await app.module.getUser(event.user.id);
    if (!user) {
        console.log('User not created yet...');
        return null;
    }
    app.module.request('PUT', '/bridge/api/users/' + user.user_id, {
        ...event.user.asJSON(),
        email: event.user.getEmail()
    })
        .then(() => true)
        .catch(() => false);
};
