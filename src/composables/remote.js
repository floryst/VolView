import { inject } from '@vue/composition-api';

const defaultKey = 'Remote';

export function useRemote(key = defaultKey) {
  return inject(key ?? defaultKey);
}
