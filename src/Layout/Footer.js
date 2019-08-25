import React from 'react';
import app from '@SE/Core/App';
import CoreWidgetFooter from '@SE/Core/Widget/Footer';

export default class SEPHPBridgeLayoutFooter extends React.Component {
    componentDidCatch (error, info) {
        app.withException(error, info);
    }

    render () {
        return (
            <CoreWidgetFooter />
        );
    }
}
