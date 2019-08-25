
try {
    module.exports = require('@socialengine/lint/.eslintrc');
} catch (e) {
    try {
        module.exports = require('./test/eslint/node_modules/@socialengine/lint/.eslintrc');
    } catch (e) {}
}
