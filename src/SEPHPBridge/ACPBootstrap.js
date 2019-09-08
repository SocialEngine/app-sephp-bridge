/**
 * @breeze-acp
 */
import app from '@SE/Core/App';
import React from 'react';
import AdminControllerUsersEdit from '@SE/SEPHPBridge/Plugin/ACP/AdminControllerUsersEdit';

app.subscribe('Nav.renderItem', function ({menu}) {
    if (menu.name === 'sephpBridgeSettings') {
        menu.hide = true;
    }
});

app.subscribe('AdminNav:nav', function (main) {
    const before = {};
    const after = {};
    let startAfter = false;
    for (const key of Object.keys(main.nav)) {
        if (startAfter) {
            after[key] = main.nav[key];
            continue;
        }
        before[key] = main.nav[key];
        if (key === 'tools') {
            startAfter = true;
        }
    }

    main.nav = {
        ...before,
        sephp: {
            title: 'SEPHP Bridge',
            icon: 'fas fa-link',
            children: [
                {
                    title: 'Settings',
                    href: '/acp/settings/sephp',
                    icon: 'fas fa-cog'
                },
                {
                    title: 'Migrations',
                    href: '/acp/sephp/migrations',
                    icon: 'fas fa-file-import'
                }
            ]
        },
        ...after
    };
});

app.hook('AdminControllerUsersEdit.render.details', function (hook) {
    return (
        <AdminControllerUsersEdit {...hook} />
    );
});
