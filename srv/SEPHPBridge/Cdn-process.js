const app = require('app');

module.exports = async function (event) {
    const check = event.payload.fileName.match(/\/@SE\/SEPHPBridge\/user\/([a-z.]+)\/(\d+)\.png/);
    if (check && check[2] !== undefined) {
        await event.payload.render(async () => {
            const type = check[1];
            const user = await app.module.getUserFromLegacyId(check[2]);
            let url = await app.data.get('sephp:url');
            let cdnUrl = await app.setting('sephp:cdnUrl');
            if (cdnUrl && cdnUrl.slice(-1) === '/') {
                url = cdnUrl.substr(0, cdnUrl.length -1);
            }
            let image = '';
            let fetchImage = null;
            if (user.images.small !== undefined) {
                let size = 'small';
                if (type === 'thumb.profile') {
                    size = 'large';
                }
                fetchImage = user.images[size];
            } else {
                if (user.picture.substr(0, 1) === '[') {
                    try {
                        const photo = JSON.parse(user.picture);
                        const find = photo.find(p => p.type === type);
                        if (find) {
                            fetchImage = url + '/' + find.path;
                        }
                    } catch (e) {
                        return image;
                    }
                }
            }
            if (fetchImage) {
                const request = await app.fetch(fetchImage);
                image = await request.buffer();
            }
            return image;
        });
    }
};
