import app from '@SE/Core/App';

app.css(`
<style>
#global_wrapper {
    padding-top: ${app.mixin.plus(app.style.contentPadding, app.style.headerHeight)};
}

.search-form-nav {
    display: block !important;
}

.post-form-nav .nav-link,
.nav-mini > .nav-item > .nav-link,
.nav-mini > .nav-item {
    display: flex !important;
}
</style>
`);
