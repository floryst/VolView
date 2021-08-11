export default class EventEmitter {
  constructor() {
    this.$events = new Map();
  }

  on(event, listener) {
    const list = this.$events.get(event) ?? [];
    list.append(listener);
    this.$events.set(event, list);
  }

  off(event, listener = null) {
    if (this.$events.has(event)) {
      const list = this.$events.get(event);
      if (listener) {
        const idx = list.indexOf(listener);
        if (idx > -1) {
          list.splice(idx, 1);
        }
      } else {
        this.$events.delete(event);
      }
    }
  }

  emit(event, ...args) {
    const list = this.$events.get(event) ?? [];
    list.forEach((listener) => listener(...args));
  }
}
