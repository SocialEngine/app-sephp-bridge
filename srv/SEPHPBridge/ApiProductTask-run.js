const app = require('app');

// EDIT[1234]

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
    }).catch(e => {
        console.log(e);
        return false;
    });
    const response = await request.json().catch(e => {
        console.log(e);
        return false;
    });
    // console.log('response', response);

    return response;
}

function handleCategory (type) {
    return async function (record) {
        const addChannel = async function _add (record, parent = null) {
            const props = {};
            if (parent !== null) {
                props.parentId = parent.id;
            }
            const channel = await app.api.users.create({
                name: app.utility.str.random(6) + '-' + record.category_name,
                type: type,
                ...props
            });
            await app.module.migration.set('categories', 'reverse:' + record.category_id, channel.id);
            console.log('Category:', type, channel.id);
            if (record.children !== undefined) {
                console.log('----');
                for (const child of record.children) {
                    await _add(child, channel);
                }
                console.log('----');
            }
        };
        await addChannel(record);
    };
}

async function handleItem (record, response) {
    let user = await app.module.getUserFromLegacyId(record.user_id);
    await app.setViewer(user.id);

    let productId = '@SE/User';
    let typeId = 'status';
    const legacyProps = {};
    const props = {};
    switch (response.table) {
        case 'engine4_blog_blogs':
            productId = '@SE/Topic';
            typeId = 'topic';
            break;
        case 'engine4_album_albums':
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
        case 'engine4_video_videos':
            productId = '@SE/Video';
            typeId = 'video';
            legacyProps.video = {
                code: record.code,
                photo: record.photo
            };
            break;
        case 'engine4_forum_topics':
            productId = '@SE/Discussion';
            typeId = 'discussion';
            break;
        case 'engine4_poll_polls':
            productId = '@SE/User';
            typeId = 'status';
            props.pollQuestion = record.subject;
            props.pollAnswer = [];
            record.subject = '';
            let answerIteration = 0;
            for (const answer of record.answers) {
                answerIteration++;
                await app.module.migration.set('pollAnswer', answer['poll_option_id'], answerIteration);
                props.pollAnswer.push(answer['poll_option']);
            }
            break;
    }

    if (record.category_id !== undefined && record.category_id) {
        const channel = await app.module.migration.getKey('categories', 'reverse:' + record.category_id);
        if (channel) {
            props.channel = [channel];
        }
    }

    if (record['creation_date'] !== undefined) {
        props.created = app.moment(record['creation_date']).unix();
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

    console.log('Post[' + response.table + ']:', post.id);

    if (record.type === 'polls') {
        for (const vote of record.votes) {
            user = await app.module.getUserFromLegacyId(vote.user_id);
            const answerId = await app.module.migration.getKey('pollAnswer', vote['poll_option_id']);
            await app.setViewer(user.id);
            await app.api.posts.update(post.id, {
                pollVote: answerId
            });
            console.log('Poll Vote:', vote.user_id, vote['poll_option_id'], answerId);
        }
    }

    if (record.comments !== undefined) {
        for (const comment of record.comments) {
            user = await app.module.getUserFromLegacyId(comment.poster_id);
            await app.setViewer(user.id);
            const commentProps = {};
            if (comment['creation_date'] !== undefined) {
                commentProps.created = app.moment(comment['creation_date']).unix();
            }
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
                },
                ...commentProps
            });
        }
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
    'forums-categories': handleCategory('discussion'),

    blogs: handleItem,
    albums: handleItem,
    status: handleItem,
    videos: handleItem,
    forums: handleItem,
    polls: handleItem,

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
    },

    messages: async record => {
        const viewer = await app.module.getUserFromLegacyId(record.user_id);
        await app.setViewer(viewer.id);
        const firstMessage = record.messages[0] || null;
        if (!firstMessage) {
            await app.module.migration.set('messages', record.id, {
                error: 'Missing first message'
            });
            return null;
        }
        const data = {
            body: firstMessage.body,
            toUser: [],
            created: app.moment(firstMessage.date).unix()
        };
        for (const user of record.users) {
            const activeUser = await app.module.getUserFromLegacyId(user.user_id);
            data.toUser.push(activeUser.id);
        }
        const message = await app.api.messages.create(data);
        if (record.messages.length > 1) {
            let iteration = 0;
            for (const m of record.messages) {
                iteration++;
                if (iteration === 1) {
                    continue;
                }
                const activeUser = await app.module.getUserFromLegacyId(m.user_id);
                await app.api.messages.create({
                    roomId: message.roomId,
                    body: m.body,
                    created: app.moment(m['date']).unix()
                }, activeUser.id);
            }
        }
        await app.module.migration.set('messages', record.id, message.roomId);
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
                await cb(record, response)
                    .catch(e => {
                        console.log('error:', e);
                    });
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
            await app.module.migration.set(type, 'failed', app.now());
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
