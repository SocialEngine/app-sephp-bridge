const app = require('app');

// EDIT[123]

module.exports = async function ({router}) {
    router.get('/redirect', async function (req, res) {
        const uri = req.get('uri');
        const handleRedirection = (type) => {
            return async (segmentKeys) => {
                const postId = await app.module.migration.getKey('posts', type + ':' + segmentKeys[':id']);
                console.log('segmentKeys', type + ':' + segmentKeys[':id'], postId);
                const post = await app.api.posts.read(postId).catch(() => false);
                if (!post) {
                    return false;
                }
                return post.permalink;
            };
        };
        const map = [
            {
                match: [
                    '/forums/topic/:id/:title/view/post_id/:post',
                    '/forums/topic/:id/:title'
                ],
                action: handleRedirection('engine4_forum_topics')
            },
            {
                match: [
                    '/blogs/:category/:id/:title'
                ],
                action: handleRedirection('engine4_blog_blogs')
            },
            {
                match: [
                    '/polls/view/:id/:title'
                ],
                action: handleRedirection('engine4_poll_polls')
            },
            {
                match: [
                    '/videos/:section/:id/:title'
                ],
                action: handleRedirection('engine4_video_videos')
            },
            {
                match: [
                    '/messages/view/id/:id'
                ],
                action: async (segmentKeys) => {
                    const messageId = await app.module.migration.getKey('messages', segmentKeys[':id']);
                    if (messageId) {
                        return '/messages/' + messageId;
                    }
                }
            }
        ];
        let callMatch = null;
        const segmentKeys = [];
        const segments = {};
        for (const item of map) {
            for (const match of item.match) {
                if (app.pathToRegex(match, segmentKeys).exec(uri)) {
                    callMatch = item.action;
                    let matchParts = match.split('/');
                    let uriParts = uri.split('/');
                    for (const segment of segmentKeys) {
                        let iteration = 0;
                        for (const matchPart of matchParts) {
                            if (matchPart === ':' + segment.name) {
                                break;
                            }
                            iteration++;
                        }
                        segments[':' + segment.name] = uriParts[iteration] || null;
                    }
                    break;
                }
            }
            if (callMatch) {
                break;
            }
        }
        if (callMatch) {
            const r = await callMatch(segments);
            if (r) {
                return res({
                    to: r
                });
            }
        }
        res({
            error: 'No redirect found.'
        });
    });

    router.get('/users/:id', async function (req, res) {
        await app.api.adminsOnly();
        res(await app.module.getUser(req.get(':id'), {
            user_id: req.get('se_user_id')
        }));
    });

    router.put('/users/:id', async function (req, res) {
        await app.api.adminsOnly();
        res({
            id: req.get(':id'),
            hello: await app.module.updateUser(req.get(':id'), {
                user_id: req.get('se_user_id')
            })
        });
    });

    router.get('/connect/:auth', async function (req, res) {
        await app.api.adminsOnly();

        let url = req.get('return');
        url = url.replace('/admin/unite-bridge/manage', '');
        const apiKey = await app.site.generateNewApiKey();
        const viewerApiToken = await app.api.users.generateApiToken(
            app.viewer.id
        );
        const request = await app.fetch(url + '/bridge/connect/auth', {
            method: 'POST',
            body: JSON.stringify({
                auth: req.get(':auth'),
                apiKey: apiKey.publicKey + ':' + apiKey.privateKey,
                viewerToken: viewerApiToken.token,
                siteId: app.site.id()
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await request.json();
        if (data.error !== undefined) {
            res(data);
        } else {
            await app.data.set('sephp:auth', req.get(':auth'));
            await app.data.set('sephp:token', data.token);
            await app.data.set('sephp:url', url);
            await app.site.rebuildJs();
            res({
                success: true
            });
        }
    });

    router.get('/migrations', async function (req, res) {
        const migrations = [];
        const records = app.module.migration.all();
        for (const type of Object.keys(records)) {
            const migration = await app.module.migration.get(type);
            migrations.push(migration);
        }
        res({
            records: migrations
        });
    });

    router.post('/migrations/:type', async function (req, res) {
        await app.api.adminsOnly();
        const type = req.get(':type');
        const page = req.get('page', 1);
        const migrations = app.module.migration.all();

        if (migrations[type] === undefined) {
            app.error('Not a valid migration');
        }

        const socketId = app.utility.str.random(32);

        await app.module.migration.set(type, 'started', app.now());
        await app.module.migration.set(type, 'socketId', socketId);
        await app.module.migration.set(type, 'page', page);
        await app.module.migration.set(type, 'limit', req.get('limit', 100));
        await app.module.migration.del(type, 'completed');
        await app.module.migration.del(type, 'total');

        const migration = await app.module.migration.get(type);
        const id = app.task('migration', {
            type: type,
            limit: req.get('limit', 100),
            returnId: req.get('returnId', false)
        });
        await app.module.migration.set(type, 'taskId', id);
        res(migration);
    });

    router.get('/sso', async function (req, res) {
        const token = req.get('token');
        if (!token) {
            app.error('Missing auth token');
        }
        const tokenKey = 'auth:token:' + token;
        let data = await app.data.get(tokenKey);
        if (!data) {
            app.error('Not a valid token.');
        }
        await app.data.del(tokenKey);
        data = JSON.parse(data);
        res({
            data: data
        });
    });

    router.post('/sso', async function (req, res) {
        await app.api.viewerOnly();
        const viewer = app.viewer;
        if (!viewer) {
            app.error('Need to be logged in.');
        }
        const token = app.utility.str.random(128);
        const user = await app.module.getUser(viewer.id);
        const url = await app.module.getUrl();
        const tokenKey = 'auth:token:' + token;
        app.data.set(tokenKey, JSON.stringify({
            uniteUserId: viewer.id,
            viewer: await app.api.users.read(viewer.id, {
                include: 'email'
            }),
            sephpUserId: user ? user.user_id : null
        }));
        app.data.expire(tokenKey, 300);
        res({
            url: url + '/bridge/connect/sso?token=' + token
        });
    });
};
