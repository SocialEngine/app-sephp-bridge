/**
 * @breeze-acp
 */
import React from 'react';
import app from '@SE/Core/App';
import AdminController from '@SE/Admin/Controller';
import Button from '@SE/Core/Button';
import Icon from '@SE/Core/Icon';
import Loader from '@SE/Core/Loader';
import Progress from '@SE/Core/Progress';
import Badge from '@SE/Core/Badge';
import Alert from '@SE/Core/Alert';

const phpUrl = app.config('sephp').url;

export default class SEPHPBridgeControllerACPMigrations extends React.Component {
    static propTypes = {};

    constructor (props) {
        super(props);

        this.listeners = [];
        this.state = {
            limit: 2,
            records: [],
            meta: {},
            hasStarted: []
        };
    }

    componentDidCatch (error, info) {
        app.withException(error, info);
    }

    componentDidMount () {
        if (!phpUrl) {
            return null;
        }
        app.api('/@SE/SEPHPBridge/migrations')
            .filter()
            .then(response => {
                for (const record of response.records) {
                    this.subscribeToSocket(record);
                }
                this.setState({
                    records: response.records
                });
            });
    }

    componentWillUnmount () {
        app.unsubscribe(this.listeners);
    }

    subscribeToSocket (response) {
        if (!response.socketId) {
            return null;
        }
        this.listeners.push(app.subscribe('ws:' + response.socketId, (data) => {
            console.log(data.migration);
            this.setState({
                records: this.state.records.map(record => {
                    if (record.id === data.migration.id) {
                        return response;
                    }
                    return record;
                }),
                meta: {
                    ...this.state.meta,
                    [response.id]: {
                        page: data.page,
                        total: data.total
                    }
                }
            });
        }));
    }

    handleMigration (type) {
        return () => {
            this.setState({
                hasStarted: this.state.hasStarted.concat(type)
            }, () => {
                app.api('/@SE/SEPHPBridge/migrations/' + type)
                    .create({
                        limit: this.state.limit
                    })
                    .then(response => {
                        this.subscribeToSocket(response);
                        this.setState({
                            records: this.state.records.map(record => {
                                if (record.id === response.id) {
                                    return response;
                                }
                                return record;
                            })
                        }, () => {
                            this.setState({
                                hasStarted: this.state.hasStarted.filter(g => g !== response.id)
                            });
                        });
                    });
            });
        };
    }

    getTotalPages (meta) {
        return Math.ceil(meta.total / this.state.limit);
    }

    isCompleted (meta) {
        const pages = this.getTotalPages(meta);
        return (meta.page >= pages);
    }

    renderProgress (record) {
        const meta = this.state.meta[record.id] || null;
        if (!meta) {
            return null;
        }
        const pages = this.getTotalPages(meta);
        if (this.isCompleted(meta)) {
            return null;
        }
        const progress = Math.floor((meta.page / meta.total) * 100);
        return (
            <div className="d-flex">
                <div>
                    <Progress progress={progress} />
                </div>
                <div className="ml-auto">
                    <Badge className="badge-secondary">
                        {meta.page}/{pages}
                    </Badge>
                </div>
            </div>
        );
    }

    renderButton (record) {
        const meta = this.state.meta[record.id] || null;
        let isCompleted = false;
        if (meta) {
            isCompleted = this.isCompleted(meta);
        }
        if ((!record.completed && record.started) || (this.state.hasStarted.includes(record.id) && !isCompleted)) {
            return (
                <div><Loader /></div>
            );
        }
        if ((record.completed && !app.get('force')) || isCompleted) {
            return (
                <div style={{fontSize: '22px'}}>
                    <Icon
                        className="far fa-check-circle"
                        parentClassName="success" />
                </div>
            );
        }
        return (
            <Button onClick={this.handleMigration(record.id)}>Start</Button>
        );
    }

    renderRecord (record) {
        return (
            <div className="list-group-item" key={record.id}>
                {this.renderProgress(record)}
                <div className="d-flex align-items-center">
                    <div className="text-uppercase">
                        {record.name}
                    </div>
                    <div className="ml-auto">
                        {this.renderButton(record)}
                    </div>
                </div>
            </div>
        );
    }

    render () {
        if (!phpUrl) {
            return (
                <Alert>
                    Log into your SEPHP Admin Panel and first create a bridge to Unite.
                </Alert>
            );
        }
        return (
            <AdminController
                title="SEPHP Migrations"
                h1="SEPHP Migrations"
            >
                <div className="list-group">
                    {this.state.records.map(record => this.renderRecord(record))}
                </div>
            </AdminController>
        );
    }
}
