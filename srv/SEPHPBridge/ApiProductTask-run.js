const app = require('app');

// EDIT[123]

async function apiRequest (endpoint, query = {}) {
    const url = await app.data.get('sephp:url');
    const token = await app.data.get('sephp:token');
    let search = '';
    let iteration = 0;
    for (const key of Object.keys(query)) {
        iteration++;
        if (iteration !== 1) {
            search += '&';
        }
        search += key + '=' + query[key];
    }
    if (search) {
        search = '?' + search;
    }
    const request = await app.fetch(url + '/bridge/migrations' + endpoint + search, {
        headers: {
            'SE-Unite-Token': token
        }
    });
    const response = await request.json();
    // console.log('response', response);

    return response;
}

function handleCategory (type) {
    return async function (record) {
        const channel = await app.api.users.create({
            name: app.utility.str.random(6) + '-' + record.category_name,
            type: type
        });
        await app.module.migration.set('categories', 'reverse:' + record.category_id, channel.id);
        console.log('category', type, record.category_id, channel.id);
    };
}

async function handleItem (record) {
    let user = await app.module.getUserFromLegacyId(record.subject_id);
    await app.setViewer(user.id);

    let productId = '@SE/User';
    let typeId = 'status';
    const legacyProps = {};
    const props = {};
    switch (record.type) {
        case 'blog_new':
            productId = '@SE/Topic';
            typeId = 'topic';
            break;
        case 'album_photo_new':
            productId = '@SE/Media';
            typeId = 'image';
            const storageIds = [];
            for (const photoUrl of record.photos) {
                const storage = await app.api.storage.create({
                    productId: '@SE/Media',
                    typeId: 'image',
                    externalFile: photoUrl
                });
                if (storage) {
                    storageIds.push(storage.id);
                }
            }
            props.storageId = storageIds;
            break;
        case 'video_new':
            productId = '@SE/Video';
            typeId = 'video';
            legacyProps.video = {
                code: record.code,
                photo: record.photo
            };
            break;
    }

    if (record.category_id !== undefined && record.category_id) {
        const channel = await app.module.migration.getKey('categories', 'reverse:' + record.category_id);
        if (channel) {
            props.channel = [channel];
        }
    }

    const createProps = {
        productId: productId,
        typeId: typeId,
        body: record.body,
        subject: record.subject || '',
        objects: {
            legacy: {
                id: record.id,
                type: record.type,
                params: record.params,
                ...legacyProps
            }
        },
        ...props
    };
    const post = await app.api.posts.create(createProps).catch(e => {
        console.error(e);
        return false;
    });

    if (!post) {
        return null;
    }
    await app.module.migration.set('posts', record.type + ':' + record.id, post.id);

    console.log('Post:', post.id);

    for (const comment of record.comments) {
        user = await app.module.getUserFromLegacyId(comment.poster_id);
        await app.setViewer(user.id);
        await app.api.posts.create({
            productId: '@SE/Comment',
            typeId: 'comment',
            parentId: post.postId,
            body: comment.body,
            objects: {
                legacy: {
                    id: comment.id,
                    params: comment.params
                }
            }
        });
    }
}

const handleMigration = {
    connections: async function (record) {
        let user = await app.module.getUserFromLegacyId(record.object_id);
        let connection = await app.module.getUserFromLegacyId(record.subject_id);
        await app.setViewer(user.id);
        const response = await app.api.connections.create(connection.id).catch(() => false);
        console.log('connection:', user.id, '->', connection.id, '->', response);
    },

    'blogs-categories': handleCategory('blogs'),
    'albums-categories': handleCategory('photos'),
    'videos-categories': handleCategory('videos'),

    blogs: handleItem,
    albums: handleItem,
    status: handleItem,
    videos: handleItem,

    users: async function (record) {
        let user = await app.api.users.findByEmail(record.email);
        if (!record.picture) {
            record.picture = '';
        } else {
            record.picture = JSON.stringify(record.picture);
        }
        if (!user) {
            if (!record.username) {
                record.username = 'profile' + record.id;
            }
            let group = 'member';
            switch (record.groups) {
                case 'admin':
                    group = 'owner';
                    break;
                case 'moderator':
                    group = 'admin';
                    break;
            }
            record.groups = [group];
            record.agree = true;
            console.log('CREATE USER:');
            user = await app.api.users.create(record).catch(() => false);
        } else {
            console.log('UPDATE USER:', user.id);
            user = await app.api.users.update(user.id, {
                picture: record.picture
            }).catch(() => false);
        }
        if (user) {
            await app.module.migration.set('users', 'reverse:' + record.id, user.id);
            await app.module.migration.set('users', 'data:' + user.id, JSON.stringify({
                user_id: record.id
            }));
        }
    }
};

function startMigration (type, cb, limit = 2) {
    return new Promise(async function (resolve) {
        const migration = await app.module.migration.get(type);
        const start = async function request (page) {
            limit = parseInt(limit);
            const response = await apiRequest('/' + type, {
                page: page,
                limit: limit
            });
            await app.module.migration.set(type, 'total', response.total);
            await app.module.migration.set(type, 'page', page);
            app.websocket.send(migration.socketId, {
                page: page,
                total: response.total,
                migration: await app.module.migration.get(type)
            });
            for (const record of response.records) {
                await cb(record)
                    .catch(e => {
                        console.log('error:', e);
                    })
            }
            if (response.records.length) {
                return request((page + 1));
            } else {
                resolve();
            }
        };
        return start(1);
    });
}

module.exports = async function ({task}) {
    task('migration', async function (params) {
        const type = params.type;
        const migration = await app.module.migration.get(type);
        const response = await startMigration(type, handleMigration[type], params.limit).catch(() => {
            return false;
        });
        if (response === false) {
            await app.module.migration.set(type, 'failed', e.message);
        } else {
            await app.module.migration.set(type, 'completed', app.now());
        }
        app.websocket.send(migration.socketId, {
            page: 0,
            total: 0,
            migration: await app.module.migration.get(type)
        });
    });
};
