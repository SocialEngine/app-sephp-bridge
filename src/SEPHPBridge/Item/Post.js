import React from 'react';
import $ from 'jquery';
import PropTypes from 'prop-types';
import app from '@SE/Core/App';
import PostPlaceholder from '@SE/Post/Placeholder';
import UserImage from '@SE/User/Image';
import Time from '@SE/Core/Time';

app.css(`
<style>
.post-activity {
    margin-bottom: 30px;
    background: ${app.style.cardBg};
    border-radius: ${app.style.cardBorderRadius};
}

.post-activity-parent {
    border-left: 4px ${app.style.gray200} solid;
    margin-top: 10px;
    padding: 10px;
}

.post-activity-body {
    padding: ${app.style.cardBodyPadding};
}

.post-activity-parent a {
    color: ${app.style.textFocus};
}

.post-activity-placeholder {
    margin-bottom: 30px;
}
</style>
`);

window['_legacyResponse'] = function (id, response) {
    app.state.set('legacyResponse:' + id, response);
};

const legacyUrl = app.config('sephp').url;

export default class ItemPost extends React.Component {
    static propTypes = {
        post: PropTypes.object.isRequired
    };

    constructor (props) {
        super(props);

        const post = this.props.post;
        this.state = {
            post: post,
            legacyPost: null,
            ready: false,
            legacyId: post.objects.legacy.id,
            legacyType: null
        };
    }

    componentDidCatch (error, info) {
        app.withException(error, info);
    }

    componentDidMount () {
        const hash = app.viewer.id();
        const url = legacyUrl + '/bridge/js/' + hash + '/' + this.state.legacyId + '.js';
        $.getScript(url, () => {
            app.state.waitFor('legacyResponse:' + this.state.legacyId, response => {
                this.setState({
                    ready: true,
                    legacyPost: response,
                    legacyType: response.action.type
                });
            });
        });
    }

    componentWillUnmount () {
        app.state.clear('legacyResponse:' + this.state.legacyId);
    }

    parseHtml (html) {
        try {
            const body = $('<div />');
            body.append(html);
            body.find('a').each(function () {
                $(this).attr('href', legacyUrl + $(this).attr('href'));
            });
            html = body.html();
        } catch (e) {}
        return html;
    }

    renderBody () {
        const post = this.state.legacyPost;

        return (
            <div dangerouslySetInnerHTML={{__html: this.parseHtml(post.body)}} />
        );
    }

    renderParent () {
        const post = this.state.legacyPost;
        const type = this.state.legacyType;
        const allowedTypes = [
            'event_create',
            'group_create',
            'group_photo_upload',
            'event_photo_upload'
        ];
        let allowed = false;
        if (type.substr(0, 5) === 'like_' || allowedTypes.includes(type)) {
            allowed = true;
        }
        if (!allowed) {
            return null;
        }

        return (
            <div className="post-activity-parent">
                <a href={legacyUrl + post.parent.href}>
                    {post.parent.title}
                </a>
                <div
                    className="text-muted small"
                    dangerouslySetInnerHTML={{__html: this.parseHtml(post.parent.body)}} />
            </div>
        );
    }

    render () {
        if (!this.state.ready) {
            return <PostPlaceholder className="post-activity-placeholder" />;
        }
        const post = this.props.post;
        return (
            <article
                className="post-activity"
                data-legacy-id={this.state.legacyId}
                data-legacy-type={this.state.legacyType}
                data-post-id={post.id}
                data-post-type={post.typeId}>
                <div className="post-activity-body">
                    <div className="d-flex align-items-start">
                        <div className="mr-2">
                            <UserImage user={post.user} size="xs" />
                        </div>
                        <div>
                            <small className="text-muted" style={{
                                fontSize: app.style.fontSizeXs
                            }}>
                                <Time timestamp={post.created} />
                            </small>
                            <div>
                                {this.renderBody()}
                                {this.renderParent()}
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        );
    }
}
