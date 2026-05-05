import type { Barrier } from '../hooks/useBarriers'

export interface BarrierSelectionOptions {
  districts?: readonly string[]
  nodeDistrictMap?: ReadonlyMap<string, string>
}

function getBarrierSeverityBucket(barrier: Barrier): number {
  if (barrier.severity === 'high') return 0
  if (barrier.severity === 'medium') return 1
  return 2
}

function rankBySeverity(barriers: Barrier[]): Barrier[] {
  const ranked = barriers
    .map((barrier, index) => ({ barrier, index }))
    .sort((a, b) => {
      const scoreDelta = b.barrier.score - a.barrier.score
      return scoreDelta !== 0 ? scoreDelta : a.index - b.index
    })

  const bucketCounts = new Map<number, number>()
  return ranked
    .map(({ barrier, index }) => {
      const bucket = getBarrierSeverityBucket(barrier)
      const rank = bucketCounts.get(bucket) ?? 0
      bucketCounts.set(bucket, rank + 1)
      return { barrier, index, bucket, rank }
    })
    .sort((a, b) => (
      a.rank - b.rank
      || a.bucket - b.bucket
      || b.barrier.score - a.barrier.score
      || a.index - b.index
    ))
    .map(({ barrier }) => barrier)
}

function getBarrierDistricts(
  barrier: Barrier,
  nodeDistrictMap: ReadonlyMap<string, string>,
): string[] {
  const districts = [
    nodeDistrictMap.get(barrier.sourceId),
    nodeDistrictMap.get(barrier.targetId),
  ].filter((district): district is string => Boolean(district))
  return [...new Set(districts)]
}

export function selectBalancedBarriers(
  barriers: Barrier[],
  limit: number,
  options: BarrierSelectionOptions = {},
): Barrier[] {
  if (limit <= 0 || barriers.length === 0) return []

  const ranked = rankBySeverity(barriers)
  const districts = [...new Set(options.districts ?? [])]
  const nodeDistrictMap = options.nodeDistrictMap
  if (!nodeDistrictMap || districts.length === 0) return ranked.slice(0, limit)

  const selected = new Map<string, Barrier>()
  const baseQuota = Math.floor(limit / districts.length)
  let extraSlots = limit % districts.length

  for (const district of districts) {
    const quota = baseQuota + (extraSlots > 0 ? 1 : 0)
    if (extraSlots > 0) extraSlots -= 1
    if (quota <= 0) continue

    const districtBarriers = ranked.filter((barrier) =>
      getBarrierDistricts(barrier, nodeDistrictMap).includes(district),
    )
    let districtSelections = [...selected.values()].filter((item) =>
      getBarrierDistricts(item, nodeDistrictMap).includes(district),
    ).length
    if (districtSelections >= quota) continue

    for (const barrier of districtBarriers) {
      if (selected.size >= limit) break
      if (selected.has(barrier.id)) continue
      selected.set(barrier.id, barrier)
      districtSelections += 1
      if (districtSelections >= quota) break
    }
  }

  if (selected.size < limit) {
    for (const barrier of ranked) {
      if (selected.size >= limit) break
      if (!selected.has(barrier.id)) selected.set(barrier.id, barrier)
    }
  }

  return [...selected.values()]
}
