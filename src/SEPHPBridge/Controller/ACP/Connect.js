/**
 * @breeze-acp
 */
import React from 'react';
import app from '@SE/Core/App';
import AdminController from '@SE/Admin/Controller';
import Loader from '@SE/Core/Loader';
import ErrorMessage from '@SE/Core/Form/ErrorMessage';

export default class SEPHPBridgeControllerACPConnect extends React.Component {
    static propTypes = {};

    constructor (props) {
        super(props);

        this.state = {
            error: null
        };
    }

    componentDidCatch (error, info) {
        app.withException(error, info);
    }

    componentDidMount () {
        app.api('/@SE/SEPHPBridge/connect')
            .read(app.get('auth'), {
                return: app.get('return')
            })
            .then(response => {
                if (response.success !== undefined) {
                    window.location.href = app.get('return');
                }
            })
            .catch(e => {
                this.setState({
                    error: e.error
                });
            });
    }

    render () {
        return (
            <AdminController
                title="SEPHP Connect"
                h1="SEPHP Connect"
            >
                {this.state.error ? <ErrorMessage message={this.state.error} /> : <Loader />}
            </AdminController>
        );
    }
}
