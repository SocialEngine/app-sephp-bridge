import React from 'react';
import app from '@SE/Core/App';
import Brand from '@SE/Core/Brand';
import Nav from '@SE/Core/Nav';
import SearchFormNav from '@SE/Search/Form/Nav';

export default class SEPHPBridgeLayoutHeader extends React.Component {

    componentDidCatch (error, info) {
        app.withException(error, info);
    }

    render () {
        return (
            <header role="banner" className="header">
                <div className="container h-100">
                    <div className="d-flex align-items-center h-100">
                        <Brand />
                        <SearchFormNav />
                        <Nav location="main" iconClassName="fa-fw" />
                        <div className="ml-auto d-flex align-items-center">
                            <Nav location="mini" viewer="member" className="align-items-center" />
                            <Nav location="guest" viewer="guest" className="align-items-center" />
                        </div>
                    </div>
                </div>
            </header>
        );
    }
}
