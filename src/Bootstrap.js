import app from '@SE/Core/App';

import '@SE/SEPHPBridge/Style/Common';

app.subscribe('ComponentsUserServiceAuth.login', function (event) {
    event.payload.bypass = true;
    app.api('/@SE/SEPHPBridge/sso')
        .create()
        .then(response => {
            window.location.href = response.url;
        });
});

app.subscribe('AccountControllerLogout.done', function (event) {
    event.payload.bypass = true;
    window.location.href = app.config('sephp').url + '/bridge/sso?logout=true';
});
