/**
 * Robust cross-environment clipboard copy utility.
 * Attempts navigator.clipboard.writeText first, with an execCommand fallback
 * specifically designed for iframe-sandboxed environments like Figma plugins.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  // 1. Try modern Async Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      console.warn('[DesignKit] navigator.clipboard.writeText failed, attempting execCommand fallback:', err)
    }
  }

  // 2. Fallback for iframe environments using temporary textarea
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text

    // Position off-screen and invisible
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '1px'
    textArea.style.height = '1px'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.style.opacity = '0'
    textArea.setAttribute('readonly', '')

    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    textArea.setSelectionRange(0, text.length)

    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    console.error('[DesignKit] Both clipboard methods failed:', err)
    return false
  }
}
