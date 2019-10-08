const app = require('app');

/*
 * EDIT[1234]
 */

const validMigrations = {
    users: {
        id: 'users',
        name: 'Users'
    },
    connections: {
        id: 'connections',
        name: 'Connections',
        dependency: ['users']
    },
    status: {
        id: 'status',
        name: 'Status Updates',
        dependency: ['users', 'connections']
    },
    'blogs-categories': {
        id: 'blogs-categories',
        name: 'Blog Categories',
        requires: ['@SE/Topic']
    },
    blogs: {
        id: 'blogs',
        name: 'Blogs',
        dependency: ['users', 'connections', 'blog-categories'],
        requires: ['@SE/Topic']
    },
    'albums-categories': {
        id: 'albums-categories',
        name: 'Album Categories',
        requires: ['@SE/Media']
    },
    albums: {
        id: 'albums',
        name: 'Albums',
        dependency: ['users', 'connections', 'albums-categories'],
        requires: ['@SE/Topic']
    },
    'videos-categories': {
        id: 'videos-categories',
        name: 'Video Categories',
        requires: ['@SE/Video']
    },
    videos: {
        id: 'videos',
        name: 'Videos',
        dependency: ['users', 'connections', 'videos-categories'],
        requires: ['@SE/Video']
    },
    'forums-categories': {
        id: 'forums-categories',
        name: 'Forums',
        requires: ['@SE/Discussion']
    },
    forums: {
        id: 'forums',
        name: 'Forum Topics/Posts',
        dependency: ['users', 'connections', 'forums-categories'],
        requires: ['@SE/Discussion']
    },
    polls: {
        id: 'polls',
        name: 'Polls',
        dependency: ['users', 'connections'],
        requires: ['@SE/Poll']
    },
    messages: {
        id: 'messages',
        name: 'Private Messages',
        dependency: ['users'],
        requires: ['@SE/Message']
    },
    feed: {
        id: 'feed',
        name: 'Activity Feed',
        dependency: ['users', 'connections']
    }
};

module.exports = {
    migration: {
        all: () => {
            return validMigrations;
        },

        getKey: async (type, key) => {
            return app.data.get('sephp:migration:' + type + ':' + key);
        },

        set: async (type, key, value) => {
            console.log('SET:', type + ':' + key, value);
            await app.data.set('sephp:migration:' + type + ':' + key, value);
        },

        del: async (type, key) => {
            await app.data.del('sephp:migration:' + type + ':' + key);
        },

        get: async (type) => {
            const migration = validMigrations[type];
            const keys = [
                'started',
                'socketId',
                'completed',
                'failed',
                'total',
                'page',
                'taskId',
                'limit'
            ];
            for (const key of keys) {
                migration[key] = await app.data.get('sephp:migration:' + type + ':' + key);
            }
            return migration;
        }
    },

    request: async function (method, endpoint, query = {}) {
        const url = await app.data.get('sephp:url');
        const token = await app.data.get('sephp:token');
        let search = '';
        let iteration = 0;
        let props = {};
        for (const key of Object.keys(query)) {
            iteration++;
            if (iteration !== 1) {
                search += '&';
            }
            search += key + '=' + encodeURIComponent(query[key]);
        }
        if (search && method === 'GET') {
            endpoint = endpoint + '?' + search;
        }
        if (method !== 'GET') {
            props.body = JSON.stringify(query);
        }
        const request = await app.fetch(url + endpoint, {
            method: method,
            ...props,
            headers: {
                'SE-Unite-Token': token,
                'Content-Type': 'application/json'
            }
        });
        return request.json();
    },

    async getUrl () {
        return app.data.get('sephp:url');
    },

    async getUserFromLegacyId (id) {
        let legacyUser = await app.data.get(
            'sephp:migration:users:reverse:' + id
        );
        return app.api.users.read(legacyUser);
    },

    async getUser (id) {
        let legacyUser = await app.data.get(
            'sephp:migration:users:data:' + id
        );
        if (legacyUser) {
            legacyUser = JSON.parse(legacyUser);
        }
        return legacyUser;
    },

    async updateUser (id, data) {
        let current = await this.getUser(id);
        if (!current) {
            current = {};
        }
        await app.data.set(
            'sephp:migration:users:data:' + id
            , JSON.stringify({
                ...current,
                ...data
            }));

        return this.getUser(id);
    },

    async handleItem (record, response) {
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
            case 'engine4_activity_actions':
                const toIgnore = [
                    'album_photo_new',
                    'blog_new',
                    'poll_new',
                    'music_playlist_new',
                    'post_self_multi_photo',
                    'post_self',
                    'video_new',
                    'post_event',
                    'like_activity_action',
                    'comment_activity_action'
                ];
                if (toIgnore.includes(record['type'])) {
                    return null;
                }
                productId = '@SE/SEPHPBridge';
                typeId = 'post';
                legacyProps.obj = {
                    type: record.object_type
                };
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
        } else if (record['date'] !== undefined) {
            props.created = app.moment(record['date']).unix();
        }

        const createProps = {
            productId: productId,
            typeId: typeId,
            body: record.body,
            subject: record.subject || '',
            objects: {
                legacy: {
                    id: record.id,
                    table: response.table,
                    params: record.params,
                    ...legacyProps
                }
            },
            ...props
        };
        const post = await app.api.posts.create(createProps).catch(e => {
            console.log(e);
            return false;
        });

        if (!post) {
            console.log('Failed to created:', post);
            return null;
        }
        await app.module.migration.set('posts', response.table + ':' + record.id, post.id);

        console.log('Post[' + response.table + ']:', post.id);

        if (response.table === 'engine4_poll_polls') {
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

        if (record.reactions !== undefined) {
            for (const reaction of record.reactions) {
                user = await app.module.getUserFromLegacyId(reaction.poster_id);
                await app.setViewer(user.id);
                const reactionProps = {};
                if (reaction['creation_date'] !== undefined) {
                    reactionProps.created = app.moment(reaction['creation_date']).unix();
                }
                await app.api.reactions.create({
                    postId: post.postId,
                    reaction: 'heart',
                    ...reactionProps
                });
            }
        }
    }
};
