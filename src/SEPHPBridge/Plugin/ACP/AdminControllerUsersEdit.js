/**
 * @breeze-acp
 */
import React from 'react';
import PropTypes from 'prop-types';
import app from '@SE/Core/App';

export default class AdminControllerUsersEdit extends React.Component {
    static propTypes = {
        user: PropTypes.object.isRequired
    };

    constructor (props) {
        super(props);

        this.state = {

        };
    }

    componentDidCatch (error, info) {
        app.withException(error, info);
    }

    componentDidMount () {
        app.api('/@SE/SEPHPBridge/users')
            .read(this.props.user.id)
            .then(response => {
                console.log(response);
            });
    }

    render () {
        return (
            <div>TEST</div>
        );
    }
}
