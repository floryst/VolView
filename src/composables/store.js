import { computed, inject } from '@vue/composition-api';

const defaultKey = 'Store';

export function useStore(key = defaultKey) {
  return inject(key ?? defaultKey);
}

/**
 *
 * @param {{ [name: string]: Function} | Function} computedFns
 */
export function useComputedState(computedFns) {
  const store = useStore();
  return Object.entries(computedFns).reduce((acc, [name, compFn]) => {
    let cmpVal;
    if ('get' in compFn && 'set' in compFn) {
      cmpVal = computed({
        get: () => compFn.get(store.state, store.getters),
        set: (val) => compFn.set(store.dispatch, val),
      });
    } else {
      cmpVal = computed(() => compFn(store.state, store.getters));
    }
    return {
      ...acc,
      [name]: cmpVal,
    };
  }, {});
}
