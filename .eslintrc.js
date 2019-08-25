
try {
    module.exports = require('@socialengine/lint/.eslintrc');
} catch (e) {
    try {
        module.exports = require('./../lint/.eslintrc');
    } catch (e) {}
}
