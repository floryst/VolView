export const ConnectionState = {
  Connected: 'connected',
  Connecting: 'connecting',
  Disconnected: 'disconnected',
};

export const DEFAULT_ENDPOINT = 'ws://localhost:4181/ws';

export default {
  state: {
    endpoint: DEFAULT_ENDPOINT,
    connnected: ConnectionState.Disconnected,
    errors: [],
  },

  mutations: {
    setEndpoint(state, endpoint) {
      state.endpoint = endpoint;
    },
    setConnectionState(state, status) {
      state.connnected = status;
    },
    addError(state, error) {
      const { type, message } = error;
      state.errors.push({ type, message });
    },
    clearErrors(state) {
      state.errors = [];
    },
  },
};
