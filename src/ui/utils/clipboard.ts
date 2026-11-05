/**
 * Robust cross-environment clipboard copy utility.
 * Specifically designed for iframe-sandboxed environments like Figma plugins.
 * Executes synchronous execCommand('copy') with temporary textarea first within
 * the active user gesture, with automatic fallback to modern Async Clipboard API.
 */
function copyUsingExecCommand(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false

  try {
    const active = document.activeElement as HTMLElement | null
    const textArea = document.createElement('textarea')
    textArea.value = text

    // Position far off-screen to avoid layout shifts or scroll jumping
    textArea.style.position = 'fixed'
    textArea.style.top = '-9999px'
    textArea.style.left = '-9999px'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.setAttribute('readonly', '')

    document.body.appendChild(textArea)
    textArea.focus({ preventScroll: true })
    textArea.select()
    textArea.setSelectionRange(0, text.length)

    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)

    if (active && typeof active.focus === 'function') {
      try {
        active.focus({ preventScroll: true })
      } catch {
        /* ignore */
      }
    }

    return successful
  } catch (err) {
    console.warn('[DesignKit] execCommand copy error:', err)
    return false
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  // 1. Try synchronous execCommand first — runs synchronously within the active user gesture
  // and is universally supported in sandboxed iframes (e.g., Figma plugins) without permission issues.
  if (copyUsingExecCommand(text)) {
    return true
  }

  // 2. Fallback to modern Async Clipboard API if available
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      console.warn('[DesignKit] navigator.clipboard.writeText also failed:', err)
    }
  }

  console.error('[DesignKit] All clipboard copy methods failed.')
  return false
}
