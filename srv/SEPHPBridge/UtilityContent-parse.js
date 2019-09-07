const app = require('app');

module.exports = async function (event) {
    let body = event.payload.body;
    body = body.replace(/<br\/>/g, '');
    body = body.replace(/<br>/g, '');
    body = body.replace(/<br \/>/g, '');
    body = body.replace(/&lt;/g, '<');
    body = body.replace(/&gt;/g, '>');
    body = body.replace(/&amp;nbsp;/g, ' ');
    body = body.replace(/&quot;/g, '"');
    body = body.replace(/&#x2F;/g, '/')
    event.payload.body = body;
};
