import 'pinia';
import type { Framework } from 'vuetify/types';
import ProxyWrapper from './core/proxies';
import PaintTool from './core/tools/paint';

declare module 'pinia' {
  export interface PiniaCustomProperties {
    // from CorePiniaProviderPlugin
    $paint: PaintTool;
    $proxies: ProxyWrapper;
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $vuetify: Framework;
  }
}
