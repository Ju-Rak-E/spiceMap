import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_THEME, type MapTheme } from '../styles/tokens'
import AdminBoundaryLayer from './AdminBoundaryLayer'

const VWORLD_LIGHT_STYLE = (apiKey: string): maplibregl.StyleSpecification => ({
  version: 8,
  sources: {
    'vworld-base': {
      type: 'raster',
      tiles: [
        `https://api.vworld.kr/req/wmts/1.0.0/${apiKey}/Base/{z}/{y}/{x}.png`,
      ],
      tileSize: 256,
      attribution: '© 국토지리정보원',
    },
  },
  layers: [
    {
      id: 'vworld-base',
      type: 'raster',
      source: 'vworld-base',
    },
  ],
  // glyphs 제거: 래스터 전용 스타일에 텍스트 레이어가 없으므로 불필요.
  // 명시하면 MapLibre가 폰트를 로드할 때까지 isStyleLoaded()=false를 유지하면서
  // 완료 후 styledata를 재발화하지 않아 GeoJSON 레이어 등록이 영구 차단됨.
})

const CARTO_DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

interface MapProps {
  theme?: MapTheme
  districtFilter?: string | null
}

export default function Map({ theme = 'light', districtFilter = null }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // 지도 초기화 (마운트 시 1회)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const apiKey = import.meta.env.VITE_VWORLD_API_KEY as string
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: theme === 'dark' ? CARTO_DARK_STYLE : VWORLD_LIGHT_STYLE(apiKey),
      center: [126.978, 37.566],
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.once('load', () => {
      mapRef.current = map
      setMapReady(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // useLayoutEffect: 모든 useEffect보다 먼저 동기적으로 실행 (paint 전)
  // setStyle()을 여기서 호출해야 AdminBoundaryLayer의 useEffect가 실행될 때
  // 이미 스타일이 변경된 상태이므로 isStyleLoaded() 체크가 정확하게 동작함.
  // useEffect에서 setStyle()을 하면 자식 컴포넌트의 styledata 리스너 등록 이후에
  // 발화하는 styledata를 놓치는 race condition이 발생함.
  useLayoutEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apiKey = import.meta.env.VITE_VWORLD_API_KEY as string
    const nextStyle = theme === 'dark' ? CARTO_DARK_STYLE : VWORLD_LIGHT_STYLE(apiKey)

    map.setStyle(nextStyle)
  }, [theme])

  const colors = MAP_THEME[theme]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', background: colors.background }}
      />
      {mapReady && mapRef.current && (
        <AdminBoundaryLayer
          map={mapRef.current}
          theme={theme}
          districtFilter={districtFilter}
        />
      )}
    </div>
  )
}
