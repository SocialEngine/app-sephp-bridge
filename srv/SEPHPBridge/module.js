const app = require('app');

/*
 * EDIT[12]
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
                'taskId'
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
    }
};
