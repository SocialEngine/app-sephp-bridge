import React from 'react';
import PropTypes from 'prop-types';
import app from '@SE/Core/App';
import PostBody from '@SE/Post/Body';

export default class ItemPost extends React.Component {
    static propTypes = {
        post: PropTypes.object.isRequired
    };

    constructor (props) {
        super(props);

        const post = this.props.post;
        const legacy = post.objects.legacy;
        this.state = {
            post: this.props.post,
            method: legacy.type + 'Render'
        };
    }

    componentDidCatch (error, info) {
        app.withException(error, info);
    }

    statusRender () {
        return (
            <div className="card-body">
                <div className="card-text">
                    <PostBody content={this.state.post.body} />
                </div>
            </div>
        );
    }

    render () {
        if (this[this.state.method] === undefined) {
            return (
                <div className="alert alert-danger">
                    {this.state.method} is not a valid Post item.
                </div>
            );
        }
        return this[this.state.method]();
    }
}
