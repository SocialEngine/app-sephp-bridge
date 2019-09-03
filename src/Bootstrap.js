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
    window.location.href = app.config('sephp').url + '/bridge/connect/sso?logout=true';
});

app.subscribe('UserImage.buildImage.picture', function (event) {
    const picture = event.payload.picture;
    if (picture.substr(0, 1) === '[') {
        try {
            const photo = JSON.parse(picture);
            const find = photo.find(p => p.type === 'default');
            if (find) {
                let url = app.config('sephp').url;
                if (app.setting('sephp:cdnUrl')) {
                    url = app.setting('sephp:cdnUrl');
                }
                event.payload.picture = url + '/' + find.path;
            }
        } catch (e) {}
    }
});
