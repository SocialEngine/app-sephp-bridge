/**
 * @breeze-acp
 */
import app from '@SE/Core/App';

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
                    title: 'Migrations',
                    href: '/acp/sephp/migrations',
                    icon: 'fas fa-file-import'
                }
            ]
        },
        ...after
    };
});
