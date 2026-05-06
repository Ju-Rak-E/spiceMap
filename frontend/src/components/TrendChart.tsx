import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GriPoint } from '../hooks/useGriHistory'

interface TrendChartProps {
  series: GriPoint[]
  width?: number
  height?: number
}

const MARGIN = { top: 8, right: 8, bottom: 24, left: 28 }

export default function TrendChart({ series, width = 240, height = 110 }: TrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || series.length === 0) return

    const innerW = width - MARGIN.left - MARGIN.right
    const innerH = height - MARGIN.top - MARGIN.bottom

    d3.select(svg).selectAll('*').remove()

    const g = d3.select(svg)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    const xScale = d3.scalePoint<string>()
      .domain(series.map(d => d.ts))
      .range([0, innerW])
      .padding(0.1)

    const yExtent = d3.extent(series, d => d.gri) as [number, number]
    const yPad = 5
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([innerH, 0])

    // 그리드 라인
    g.append('g')
      .call(
        d3.axisLeft(yScale)
          .ticks(3)
          .tickSize(-innerW)
          .tickFormat(() => ''),
      )
      .call(sel => sel.select('.domain').remove())
      .call(sel => sel.selectAll('line').attr('stroke', '#37474F').attr('stroke-dasharray', '3,3'))

    // X축 (마지막 3개 ts만 표시)
    const xTicks = series.length > 3 ? series.slice(-3).map(d => d.ts) : series.map(d => d.ts)
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(xTicks)
          .tickSize(3),
      )
      .call(sel => sel.select('.domain').attr('stroke', '#546E7A'))
      .call(sel => sel.selectAll('text').attr('fill', '#546E7A').style('font-size', '9px'))
      .call(sel => sel.selectAll('line').attr('stroke', '#546E7A'))

    // Y축
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(3).tickSize(3))
      .call(sel => sel.select('.domain').attr('stroke', '#546E7A'))
      .call(sel => sel.selectAll('text').attr('fill', '#546E7A').style('font-size', '9px'))
      .call(sel => sel.selectAll('line').attr('stroke', '#546E7A'))

    // 라인
    const line = d3.line<GriPoint>()
      .x(d => xScale(d.ts) ?? 0)
      .y(d => yScale(d.gri))
      .curve(d3.curveCatmullRom)

    g.append('path')
      .datum(series)
      .attr('fill', 'none')
      .attr('stroke', '#43A047')
      .attr('stroke-width', 2)
      .attr('d', line)

    // 마지막 포인트 강조
    const last = series[series.length - 1]
    if (last) {
      g.append('circle')
        .attr('cx', xScale(last.ts) ?? 0)
        .attr('cy', yScale(last.gri))
        .attr('r', 4)
        .attr('fill', '#43A047')
        .attr('stroke', '#1A2332')
        .attr('stroke-width', 2)
    }
  }, [series, width, height])

  if (series.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#90A4AE', fontWeight: 600 }}>분기 시계열 미보유</span>
        <span style={{ fontSize: 9, color: '#546E7A' }}>이 상권은 단일 분기(2025Q4)만 분석 적재됨</span>
      </div>
    )
  }

  return <svg ref={svgRef} width={width} height={height} />
}
