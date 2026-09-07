import type { UIMessage } from '../../shared/types'

/**
 * Send a typed message from the UI iframe to the Figma plugin sandbox.
 */
export function sendToPlugin(msg: UIMessage): void {
  parent.postMessage({ pluginMessage: msg }, '*')
}
