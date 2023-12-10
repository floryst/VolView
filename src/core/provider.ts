import ProxyWrapper from './proxies';
import PaintTool from './tools/paint';

/**
 * Pinia plugin for injecting tool services.
 */
export function CorePiniaProviderPlugin({
  paint,
  proxies,
}: {
  paint?: PaintTool;
  proxies?: ProxyWrapper;
} = {}) {
  const dependencies = {
    $paint: paint ?? new PaintTool(),
    $proxies: proxies,
  };
  return () => dependencies;
}
