// ============================================================
// src/plugin/figma/rlm/relationships.ts
// Multi-Factor Spatial & Containment Relationships
// 100% Offline & Deterministic — Zero External Dependencies
// ============================================================

import type { RLMGeometry, RLMNode } from './types'

export interface BoundingBox2D {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  centerX: number
  centerY: number
}

export function toBoundingBox(geo: RLMGeometry): BoundingBox2D {
  return {
    minX: geo.x,
    minY: geo.y,
    maxX: geo.x + geo.width,
    maxY: geo.y + geo.height,
    width: geo.width,
    height: geo.height,
    centerX: geo.x + geo.width / 2,
    centerY: geo.y + geo.height / 2,
  }
}

/**
 * Calculates 2D intersection area of two bounding boxes.
 */
export function computeIntersectionArea(a: BoundingBox2D, b: BoundingBox2D): number {
  const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX))
  const overlapY = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY))
  return overlapX * overlapY
}

/**
 * Checks if box A visually contains box B (with optional margin tolerance).
 */
export function isVisuallyContained(
  parent: BoundingBox2D,
  child: BoundingBox2D,
  tolerance = 8
): boolean {
  return (
    child.minX >= parent.minX - tolerance &&
    child.minY >= parent.minY - tolerance &&
    child.maxX <= parent.maxX + tolerance &&
    child.maxY <= parent.maxY + tolerance
  )
}

/**
 * Computes overlap ratio relative to the smaller bounding box.
 */
export function computeOverlapRatio(a: BoundingBox2D, b: BoundingBox2D): number {
  const areaA = a.width * a.height
  const areaB = b.width * b.height
  const minArea = Math.min(areaA, areaB)
  if (minArea <= 0) return 0
  const inter = computeIntersectionArea(a, b)
  return inter / minArea
}

/**
 * Determines if a group of nodes share a horizontal baseline or row.
 */
export function areNodesHorizontallyAligned(nodes: RLMNode[], tolerance = 14): boolean {
  if (nodes.length < 2) return true
  const boxes = nodes.map(n => toBoundingBox(n.geometry))
  const minCenterY = Math.min(...boxes.map(b => b.centerY))
  const maxCenterY = Math.max(...boxes.map(b => b.centerY))
  if (maxCenterY - minCenterY <= tolerance) return true

  const minY = Math.min(...boxes.map(b => b.minY))
  const maxY = Math.max(...boxes.map(b => b.minY))
  return maxY - minY <= tolerance
}

/**
 * Determines if a group of nodes are arranged along a vertical column.
 */
export function areNodesVerticallyAligned(nodes: RLMNode[], tolerance = 16): boolean {
  if (nodes.length < 2) return true
  const boxes = nodes.map(n => toBoundingBox(n.geometry))
  const minLeft = Math.min(...boxes.map(b => b.minX))
  const maxLeft = Math.max(...boxes.map(b => b.minX))
  return maxLeft - minLeft <= tolerance
}

/**
 * 2D Spatial cluster representation.
 */
export interface SpatialCluster {
  box: BoundingBox2D
  nodes: RLMNode[]
}

/**
 * Groups loose nodes into 2D spatial clusters using containment, proximity, and visual bands.
 * Unlike naive 1D Y-overlap, this respects horizontal boundaries and prevents interleaving unrelated columns.
 */
export function clusterNodes2D(
  nodes: RLMNode[],
  canvasWidth: number,
  verticalGapThreshold = 36,
  horizontalGapThreshold = 40
): SpatialCluster[] {
  if (nodes.length === 0) return []

  // Sort nodes top-to-bottom, then left-to-right
  const sorted = [...nodes].sort((a, b) => {
    const dy = a.geometry.y - b.geometry.y
    if (Math.abs(dy) > 12) return dy
    return a.geometry.x - b.geometry.x
  })

  const clusters: SpatialCluster[] = []

  for (const node of sorted) {
    const nBox = toBoundingBox(node.geometry)
    let assigned = false

    // Check existing clusters for spatial proximity or containment
    for (const cluster of clusters) {
      const cBox = cluster.box
      const isVerticallyNear =
        nBox.minY <= cBox.maxY + verticalGapThreshold &&
        nBox.maxY >= cBox.minY - verticalGapThreshold
      const isHorizontallyNear =
        nBox.minX <= cBox.maxX + horizontalGapThreshold &&
        nBox.maxX >= cBox.minX - horizontalGapThreshold

      if (isVerticallyNear && isHorizontallyNear) {
        cluster.nodes.push(node)
        cluster.box = {
          minX: Math.min(cBox.minX, nBox.minX),
          minY: Math.min(cBox.minY, nBox.minY),
          maxX: Math.max(cBox.maxX, nBox.maxX),
          maxY: Math.max(cBox.maxY, nBox.maxY),
          width: Math.max(cBox.maxX, nBox.maxX) - Math.min(cBox.minX, nBox.minX),
          height: Math.max(cBox.maxY, nBox.maxY) - Math.min(cBox.minY, nBox.minY),
          centerX: (Math.min(cBox.minX, nBox.minX) + Math.max(cBox.maxX, nBox.maxX)) / 2,
          centerY: (Math.min(cBox.minY, nBox.minY) + Math.max(cBox.maxY, nBox.maxY)) / 2,
        }
        assigned = true
        break
      }
    }

    if (!assigned) {
      clusters.push({
        box: { ...nBox },
        nodes: [node],
      })
    }
  }

  // Sort clusters naturally top-to-bottom
  clusters.sort((a, b) => a.box.minY - b.box.minY)
  return clusters
}
