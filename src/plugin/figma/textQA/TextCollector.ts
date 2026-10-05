import type { CollectedTextNode, CollectTextNodesResponse } from '../../../shared/types'

/**
 * Dedicated text collection utility for Text QA.
 * Recursively traverses selected nodes and collects all descendant TEXT nodes.
 * Does NOT modify any text during scanning.
 */
export function collectTextNodes(selection: readonly SceneNode[]): CollectTextNodesResponse {
  const nodes: CollectedTextNode[] = []
  const visited = new Set<string>()

  function scanNode(node: SceneNode, parentName?: string, parentId?: string) {
    if (visited.has(node.id)) return
    visited.add(node.id)

    // Skip hidden layers
    if (node.visible === false) return

    if (node.type === 'TEXT') {
      const textNode = node as TextNode
      nodes.push({
        nodeId: textNode.id,
        nodeName: textNode.name,
        characters: textNode.characters,
        textContent: textNode.characters,
        parentName: parentName ?? textNode.parent?.name,
        parentId: parentId ?? textNode.parent?.id,
      })
    }

    if ('children' in node) {
      const container = node as ChildrenMixin
      for (const child of container.children) {
        scanNode(child, node.name, node.id)
      }
    }
  }

  if (selection && selection.length > 0) {
    for (const root of selection) {
      scanNode(root)
    }
  }

  const rootName =
    selection.length === 1
      ? selection[0].name
      : selection.length > 1
        ? `${selection.length} selected layers`
        : undefined

  return {
    nodes,
    rootName,
    selectionCount: selection.length,
  }
}
