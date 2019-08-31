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
import {render, Modal} from '@SE/Core/Modal';
import {Form, Number, Submit} from '@SE/Core/Form';
import {getProduct} from '@SE/Core/Base/Site';

const phpUrl = app.config('sephp').url;

export default class SEPHPBridgeControllerACPMigrations extends React.Component {
    static propTypes = {};

    constructor (props) {
        super(props);

        this.listeners = [];
        this.state = {
            limit: 500,
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

    startMigration (type, limit, cb) {
        this.setState({
            hasStarted: this.state.hasStarted.concat(type),
            limit: limit
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
                        }, cb);
                    });
                });
        });
    }

    handleMigration (record) {
        return () => {
            render(
                <Modal
                    title={'Migrate: ' + record.name}
                    whenReady={modal => (
                        <Form
                            coverOnSubmit={true}
                            onSubmit={({values}) => {
                                this.startMigration(record.id, values.total || 1000, () => {
                                    modal.close();
                                });
                            }}
                            values={{
                                total: 1000
                            }}
                            render={({as}) => (
                                <React.Fragment>
                                    <Number
                                        {...as('total')}
                                        label="How many records per request should we import?"
                                        value={1000}
                                    />
                                    <Submit value="Start" />
                                </React.Fragment>
                            )} />
                    )}
                />
            );
        };
    }

    getTotalPages (meta) {
        console.log('getTotalPages');
        console.log('meta.total:', meta.total);
        console.log('this.state.limit', this.state.limit);
        return Math.ceil(meta.total / this.state.limit);
    }

    isCompleted (meta) {
        const pages = this.getTotalPages(meta);
        return (meta.page >= pages);
    }

    hasDependency (record) {
        let hasDependency = false;
        if (record.dependency !== undefined && Array.isArray(record.dependency)) {
            for (const check of record.dependency) {
                const find = this.state.records.find(r => r.id === check);
                if (find && !find.completed) {
                    hasDependency = true;
                    break;
                }
            }
        }

        return hasDependency;
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
        console.log('progress', progress);
        return (
            <div className="row align-items-center mb-2">
                <div className="col">
                    <Progress progress={progress} />
                </div>
                <div className="col-auto">
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
        if (this.hasDependency(record)) {
            return (
                <div className="text-muted small">
                    Requires import of {record.dependency.map(name => {
                        const item = this.state.records.find(r => r.id === name);
                        if (!item) {
                            return null;
                        }
                        if (item.completed) {
                            return null;
                        }
                        return (
                            <span key={name} className={app.withClass(
                                'badge text-uppercase mr-1',
                                item.completed ? 'badge-success' : 'badge-secondary'
                            )}>
                            {item.name}
                        </span>
                        );
                    })}
                </div>
            );
        }
        if (((!record.completed && !isCompleted && record.started) || this.state.hasStarted.includes(record.id)) &&
            (!app.get('force'))
        ) {
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
            <Button onClick={this.handleMigration(record)}>Start</Button>
        );
    }

    renderRecord (record) {
        if (record.requires !== undefined) {
            const find = record.requires.find(f => !getProduct(f));
            if (find) {
                return null;
            }
        }
        return (
            <div className="list-group-item" key={record.id}>
                {this.renderProgress(record)}
                <div className="d-flex align-items-center">
                    <div>
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
