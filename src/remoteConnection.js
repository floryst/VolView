import HostConnection from '../server/host';
import { ConnectionState } from './store/remote';

export default class RemoteConnection {
  constructor(store) {
    this.store = store;
    this.conn = null;
  }

  async connect() {
    this.disconnect();

    const { endpoint } = this.store.state.remote;
    this.conn = new HostConnection(endpoint);

    this.conn.on('connected', () => {
      this.store.commit('remote/setConnectionState', ConnectionState.Connected);
    });
    this.conn.on('disconnected', () => {
      this.store.commit(
        'remote/setConnectionState',
        ConnectionState.Disconnected
      );
    });
    this.conn.on('error', (err) => {
      this.store.commit('remote/addError', {
        name: err.name,
        message: err.message,
      });
    });
  }

  disconnect() {
    if (this.conn) {
      this.conn.disconnect();
      this.conn.off();
      this.conn = null;
    }
  }

  async call(endpoint, ...args) {
    return this.conn.call(endpoint, ...args);
  }
}
