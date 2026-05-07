import { TextLayer } from '@deck.gl/layers'
import type { CommerceNode } from '../types/commerce'
import type { HeightMetric } from '../hooks/use3DView'
import { hexToRgba } from '../utils/colorUtils'
import { getMetricValue } from '../utils/threeDUtils'

const MIN_SIZE = 18
const MAX_SIZE = 42
const MAX_COUNT = 5
const OFFSET_STEP = 0.00018

interface PictogramDatum {
  id: string
  nodeId: string
  position: [number, number]
  text: string
  size: number
  color: [number, number, number, number]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function getPictogramText(metric: HeightMetric): string {
  switch (metric) {
    case 'griScore':
      return '!'
    case 'netFlow':
      return '人'
    case 'closeRate':
      return '×'
    case 'degreeCentrality':
      return '●'
  }
}

function getPictogramColor(metric: HeightMetric): [number, number, number, number] {
  switch (metric) {
    case 'griScore':
      return hexToRgba('#EF5350', 230)
    case 'netFlow':
      return hexToRgba('#42A5F5', 230)
    case 'closeRate':
      return hexToRgba('#FFB74D', 230)
    case 'degreeCentrality':
      return hexToRgba('#7BD08D', 230)
  }
}

function getComparableValue(node: CommerceNode, metric: HeightMetric): number {
  const value = getMetricValue(node, metric)
  return metric === 'netFlow' ? Math.max(0, value) : value
}

function getPictogramOffset(index: number, count: number): [number, number] {
  if (count === 1) return [0, 0]
  const angle = (Math.PI * 2 * index) / count
  const radius = OFFSET_STEP * (count <= 3 ? 1 : 1.35)
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
}

export function buildCommercePictogramData(
  nodes: CommerceNode[],
  metric: HeightMetric,
): PictogramDatum[] {
  const values = nodes.map((node) => getComparableValue(node, metric))
  const min = metric === 'netFlow' ? 0 : Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const text = getPictogramText(metric)
  const color = getPictogramColor(metric)
  const data: PictogramDatum[] = []

  for (const node of nodes) {
    const value = getComparableValue(node, metric)
    const intensity = max === min ? (max > 0 ? 0.5 : 0) : clamp01((value - min) / (max - min))
    const count = Math.max(1, Math.round(1 + intensity * (MAX_COUNT - 1)))
    const size = MIN_SIZE + intensity * (MAX_SIZE - MIN_SIZE)

    for (let i = 0; i < count; i += 1) {
      const [dx, dy] = getPictogramOffset(i, count)
      data.push({
        id: `${node.id}-${i}`,
        nodeId: node.id,
        position: [node.coordinates[0] + dx, node.coordinates[1] + dy],
        text,
        size,
        color,
      })
    }
  }

  return data
}

export function createCommerceColumnLayer(
  nodes: CommerceNode[],
  metric: HeightMetric,
): TextLayer<PictogramDatum> {
  const data = buildCommercePictogramData(nodes, metric)
  return new TextLayer<PictogramDatum>({
    id: 'commerce-pictogram',
    data,
    getPosition: (d) => d.position,
    getText: (d) => d.text,
    getSize: (d) => d.size,
    getColor: (d) => d.color,
    sizeUnits: 'pixels',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 800,
    characterSet: '人!×●',
    billboard: true,
    pickable: false,
    updateTriggers: {
      getPosition: [metric, nodes.length],
      getText: [metric],
      getSize: [metric, nodes.length],
      getColor: [metric],
    },
  })
}
