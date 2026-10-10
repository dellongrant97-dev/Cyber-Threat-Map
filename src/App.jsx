import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import landShapes from './landShapes.js'
import {
  loadCachedGeoRetrievedAt,
  loadCachedThreatFeed,
  recordGeoRetrievalSuccess,
  loadThreatFeed,
  resolveIndicatorLocations,
  threatFeedInfo,
} from './threatIntel.js'
import { globalEventsInfo, loadCachedGlobalEvents, loadGlobalEvents } from './globalEvents.js'
import { globalNewsInfo, loadCachedGlobalNews, loadGlobalNews } from './globalNews.js'
import { filterIndicators } from './indicatorFilters.js'
import { loadCachedVulnerabilities, loadVulnerabilities, vulnerabilityIntelInfo } from './vulnerabilityIntel.js'
import {
  findDomainReports,
  findIpReputation,
  loadCachedOpenPhishFeed,
  loadOpenPhishFeed,
  serializeThreatLookup,
  threatSearchInfo,
  validateThreatLookupInput,
} from './threatSearch.js'
import { buildThreatTrendModel } from './threatTrends.js'
import { buildSourceHealthRows } from './sourceHealth.js'
import { logClientError } from './clientLog.js'

const tabs = [
  { label: 'Overview', icon: 'grid', target: 'overview' },
  { label: 'Threat map', icon: 'radar', target: 'threat-map' },
  { label: 'Indicators', icon: 'alert', target: 'indicator-panel' },
  { label: 'Activity', icon: 'clock', target: 'activity-timeline' },
  { label: 'Trends', icon: 'pulse', target: 'trend-analytics' },
  { label: 'Lookup', icon: 'search', target: 'threat-search-panel' },
  { label: 'Vulnerabilities', icon: 'alert', target: 'vulnerability-panel' },
  { label: 'Source health', icon: 'pulse', target: 'source-health-panel' },
  { label: 'Learning', icon: 'grid', target: 'learning-mode' },
]

const consensusFilters = [
  { id: 'all', label: 'All indicators' },
  { id: 'high', label: '6+ sources' },
  { id: 'medium', label: '3-5 sources' },
]

function formatEventTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function formatNewsTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="m12 12 7-7M12 3v9h9" /></>,
    alert: <><path d="M10.3 3.9 2.5 17.4A1.8 1.8 0 0 0 4.1 20h15.8a1.8 1.8 0 0 0 1.6-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 3h.01" /></>,
    pulse: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    settings: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="9" cy="5" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="19" r="2" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M5 18v3h14v-3" /></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value)
}

function formatSignedNumber(value) {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`
}

function formatDate(value) {
  if (!value) return 'Waiting for source'
  return `${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))} UTC`
}

function formatVulnerabilityDate(value) {
  return Number.isFinite(value) ? formatDate(value) : 'Not provided by NVD'
}

function ThreatTrendChart({ snapshots }) {
  const width = 640
  const height = 205
  const left = 42
  const right = 624
  const top = 17
  const bottom = 160
  const maxValue = Math.max(1, ...snapshots.map((snapshot) => snapshot.totalCount))
  const points = snapshots.map((snapshot, index) => {
    const x = snapshots.length === 1 ? (left + right) / 2 : left + index * (right - left) / (snapshots.length - 1)
    return {
      ...snapshot,
      x,
      totalY: bottom - snapshot.totalCount / maxValue * (bottom - top),
      highY: bottom - snapshot.highCount / maxValue * (bottom - top),
    }
  })
  const totalPath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.totalY}`).join(' ')
  const highPath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.highY}`).join(' ')

  return (
    <div className="trend-chart-wrap">
      <svg className="trend-history-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="trend-chart-title trend-chart-description">
        <title id="trend-chart-title">Collected IPsum indicator snapshots</title>
        <desc id="trend-chart-description">Line chart of actual retrieved publisher revisions. Green shows all indicators; cyan shows indicators with six or more source-list matches. The chart contains {snapshots.length} collected snapshots.</desc>
        {[0, 0.5, 1].map((ratio) => {
          const y = bottom - ratio * (bottom - top)
          return <g key={ratio}><line x1={left} y1={y} x2={right} y2={y} className="trend-chart-grid" /><text x={left - 7} y={y + 3} textAnchor="end" className="trend-chart-label">{formatNumber(Math.round(maxValue * ratio))}</text></g>
        })}
        {points.length > 1 && <>
          <path d={totalPath} className="trend-chart-line trend-chart-total" />
          <path d={highPath} className="trend-chart-line trend-chart-high" />
        </>}
        {points.map((point) => (
          <g key={point.id}>
            <title>{`Published ${formatDate(point.publishedAt)}; retrieved ${formatDate(point.retrievedAt)}; ${formatNumber(point.totalCount)} indicators, ${formatNumber(point.highCount)} with 6+ sources`}</title>
            <circle cx={point.x} cy={point.totalY} r="3.5" className="trend-chart-point-total" />
            <circle cx={point.x} cy={point.highY} r="3.5" className="trend-chart-point-high" />
            <text x={point.x} y={bottom + 19} textAnchor="middle" className="trend-chart-label">{new Date(point.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</text>
          </g>
        ))}
      </svg>
      <div className="trend-chart-legend"><span><i className="trend-series-total" />All IPsum indicators</span><span><i className="trend-series-high" />6+ source lists</span></div>
    </div>
  )
}

function projectLocation(location) {
  return {
    x: ((location.longitude + 180) / 360) * 1000,
    y: ((90 - location.latitude) / 180) * 500,
  }
}

function WorldMap({ indicators, events, showEvents, news, showNews, selectedIp, selectedEventId, selectedNewsId, onSelect, onSelectEvent, onSelectNews }) {
  const visiblePoints = indicators
    .map((point) => ({ ...point, ...projectLocation(point) }))
  const visibleEvents = showEvents ? events.map((event) => ({ ...event, ...projectLocation(event) })) : []
  const visibleNews = showNews ? news.filter((article) => article.location).map((article) => ({
    ...article,
    ...projectLocation(article.location),
  })) : []

  return (
    <svg className="world-map" viewBox="0 0 1000 500" role="img" aria-labelledby="map-title map-desc" preserveAspectRatio="xMidYMid meet">
      <title id="map-title">Public threat intelligence and global events</title>
      <desc id="map-desc">A dotted 2D world map with approximate hosting locations for suspicious IP indicators and, when enabled, independently sourced USGS earthquake events of magnitude 4.5 or greater.</desc>
      <defs>
        <pattern id="map-dots" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".8" fill="#16452f" />
        </pattern>
        <pattern id="land-dots" width="3.6" height="3.6" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="1.05" fill="#00f28c" />
        </pattern>
      </defs>
      <rect width="1000" height="500" fill="url(#map-dots)" opacity=".42" />
      <g className="graticules">
        <path d="M0 125H1000M0 250H1000M0 375H1000" />
        <path d="M250 0v500M500 0v500M750 0v500" />
        <ellipse cx="500" cy="250" rx="470" ry="210" />
      </g>
      <g className="continents"><path d={landShapes} /></g>
      <g className="map-points">
        {visiblePoints.map((point) => (
          <g
            className={`map-point point-${point.consensus >= 6 ? 'high' : 'medium'} ${selectedIp === point.ip ? 'point-selected' : ''}`}
            key={point.ip}
            transform={`translate(${point.x} ${point.y})`}
            role="button"
            tabIndex="0"
            aria-label={`${point.ip}, listed on ${point.consensus} or more source lists, approximate IP geolocation ${point.city ? `${point.city}, ` : ''}${point.country}`}
            onClick={() => onSelect(point.ip)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(point.ip)
              }
            }}
          >
            <circle className="point-radar" r="12" />
            <circle className="point-radar point-radar-outer" r="22" />
            <circle className="point-halo" r="7" />
            <circle className="point-core" r="3.5" />
            <title>{point.ip} · {point.consensus}+ source lists · approximate IP location: {point.city ? `${point.city}, ` : ''}{point.country} · not a confirmed attack origin</title>
          </g>
        ))}
      </g>
      <g className="event-points">
        {visibleEvents.map((event) => (
          <g
            className={`event-point ${selectedEventId === event.id ? 'event-point-selected' : ''}`}
            key={event.id}
            transform={`translate(${event.x} ${event.y})`}
            role="button"
            tabIndex="0"
            aria-label={`Magnitude ${event.magnitude.toFixed(1)} earthquake, ${event.place}, ${formatEventTime(event.occurredAt)} UTC`}
            onClick={() => onSelectEvent(event.id)}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                keyEvent.preventDefault()
                onSelectEvent(event.id)
              }
            }}
          >
            <circle className="event-point-halo" r="9" />
            <circle className="event-point-core" r="4" />
            <title>M{event.magnitude.toFixed(1)} earthquake · {event.place} · {formatEventTime(event.occurredAt)} UTC · USGS</title>
          </g>
        ))}
      </g>
      <g className="news-points">
        {visibleNews.map((article) => (
          <g
            className={`news-point ${article.location.precision === 'country' ? 'news-point-country' : ''} ${selectedNewsId === article.id ? 'news-point-selected' : ''}`}
            key={article.id}
            transform={`translate(${article.x} ${article.y})`}
            role="button"
            tabIndex="0"
            aria-label={`News location: ${article.location.name}. ${article.title}. Approximate ${article.location.precision} location matched in the ${article.locationBasis}.`}
            onClick={() => onSelectNews(article.id)}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                keyEvent.preventDefault()
                onSelectNews(article.id)
              }
            }}
          >
            <circle className="news-point-area" r={selectedNewsId === article.id ? 38 : article.location.precision === 'city' ? 20 : 32} />
            <circle className="news-point-core" r="4" />
            <text className="news-point-label" x="8" y="-8">{article.location.name}</text>
            <title>{article.location.name} · approx. {article.location.precision} match · {article.title} · BBC News</title>
          </g>
        ))}
      </g>
      <g className="map-coordinates">
        <text x="22" y="28">PUBLIC THREAT INTELLIGENCE</text>
        <text x="22" y="47">{visiblePoints.length} IP LOCATIONS · {visibleEvents.length} EARTHQUAKES · {visibleNews.length} NEWS AREAS</text>
        <text x="978" y="476" textAnchor="end">APPROXIMATE LOCATIONS · DISTINCT DATA LAYERS</text>
      </g>
    </svg>
  )
}

let cachedGlobeLandDots

function getGlobeLandDots() {
  if (cachedGlobeLandDots) return cachedGlobeLandDots

  const projectionCanvas = document.createElement('canvas')
  const projectionContext = projectionCanvas.getContext('2d')
  if (!projectionContext) throw new Error('Canvas 2D is unavailable; the 3D globe cannot be rendered.')
  const landPath = new Path2D(landShapes)
  cachedGlobeLandDots = []
  for (let latitude = -88; latitude <= 88; latitude += 2.5) {
    for (let longitude = -178; longitude <= 178; longitude += 2.5) {
      const mapX = ((longitude + 180) / 360) * 1000
      const mapY = ((90 - latitude) / 180) * 500
      if (projectionContext.isPointInPath(landPath, mapX, mapY)) cachedGlobeLandDots.push({ latitude, longitude })
    }
  }
  return cachedGlobeLandDots
}

function GlobeMap({ indicators, events, showEvents, news, showNews, selectedIp, selectedEventId, selectedNewsId, onSelect, onSelectEvent, onSelectNews }) {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const requestRedrawRef = useRef(null)
  sceneRef.current = { indicators, events, showEvents, news, showNews, selectedIp, selectedEventId, selectedNewsId, onSelect, onSelectEvent, onSelectNews }

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return undefined

    const landDots = getGlobeLandDots()
    let width = 0
    let height = 0
    let frame = 0
    let lastTime = 0
    let rotation = -0.25
    let dragX = null
    let isVisible = true
    let disposed = false
    let hitTargets = []
    let keyboardIndex = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const scheduleDraw = () => {
      if (disposed || !isVisible || document.hidden || frame) return
      frame = window.requestAnimationFrame(draw)
    }
    const resizeObserver = new ResizeObserver(([entry]) => {
      const bounds = entry.contentRect
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = bounds.width
      height = bounds.height
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      scheduleDraw()
    })
    resizeObserver.observe(canvas)
    const visibilityObserver = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting
        if (isVisible) scheduleDraw()
        else if (frame) {
          window.cancelAnimationFrame(frame)
          frame = 0
        }
      })
      : null
    visibilityObserver?.observe(canvas)

    const toSphere = (latitude, longitude, centerX, centerY, radius, turn) => {
      const lat = latitude * Math.PI / 180
      const lon = (longitude * Math.PI / 180) + turn
      const depth = Math.cos(lat) * Math.cos(lon)
      return {
        x: centerX + radius * Math.cos(lat) * Math.sin(lon),
        y: centerY - radius * Math.sin(lat),
        depth,
      }
    }

    const draw = (time) => {
      frame = 0
      if (!width || !height) return
      const elapsed = lastTime ? Math.min(time - lastTime, 40) : 0
      lastTime = time
      if (!reducedMotion.matches && dragX === null) rotation += elapsed * 0.000035
      const scene = sceneRef.current
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      const radius = Math.max(48, Math.min(width * 0.36, height * 0.44))
      const centerX = width / 2
      const centerY = height / 2
      const sphere = context.createRadialGradient(centerX - radius * 0.35, centerY - radius * 0.4, radius * 0.08, centerX, centerY, radius * 1.1)
      sphere.addColorStop(0, '#10261d')
      sphere.addColorStop(0.7, '#09140f')
      sphere.addColorStop(1, '#030807')
      context.beginPath()
      context.arc(centerX, centerY, radius, 0, Math.PI * 2)
      context.fillStyle = sphere
      context.fill()
      context.save()
      context.beginPath()
      context.arc(centerX, centerY, radius, 0, Math.PI * 2)
      context.clip()

      context.strokeStyle = 'rgba(39, 111, 75, .38)'
      context.lineWidth = 0.7
      for (const latitude of [-60, -30, 0, 30, 60]) {
        context.beginPath()
        let drawing = false
        for (let longitude = -180; longitude <= 180; longitude += 3) {
          const point = toSphere(latitude, longitude, centerX, centerY, radius, rotation)
          if (point.depth > 0) {
            if (drawing) context.lineTo(point.x, point.y)
            else context.moveTo(point.x, point.y)
            drawing = true
          } else drawing = false
        }
        context.stroke()
      }
      for (const longitude of [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180]) {
        context.beginPath()
        let drawing = false
        for (let latitude = -90; latitude <= 90; latitude += 2) {
          const point = toSphere(latitude, longitude, centerX, centerY, radius, rotation)
          if (point.depth > 0) {
            if (drawing) context.lineTo(point.x, point.y)
            else context.moveTo(point.x, point.y)
            drawing = true
          } else drawing = false
        }
        context.stroke()
      }

      for (const dot of landDots) {
        const point = toSphere(dot.latitude, dot.longitude, centerX, centerY, radius, rotation)
        if (point.depth <= 0) continue
        context.globalAlpha = 0.55 + point.depth * 0.4
        context.fillStyle = '#00f28c'
        context.fillRect(point.x, point.y, 1.35, 1.35)
      }
      context.globalAlpha = 1

      hitTargets = []
      const drawMarker = (location, color, size, selected, action, label) => {
        const point = toSphere(location.latitude, location.longitude, centerX, centerY, radius, rotation)
        if (point.depth <= 0) return
        const markerSize = size * (0.72 + point.depth * 0.28)
        context.beginPath()
        context.arc(point.x, point.y, markerSize + (selected ? 4 : 2), 0, Math.PI * 2)
        context.fillStyle = `${color}33`
        context.fill()
        context.beginPath()
        context.arc(point.x, point.y, markerSize, 0, Math.PI * 2)
        context.fillStyle = color
        context.strokeStyle = selected ? '#ffffff' : '#08110d'
        context.lineWidth = selected ? 1.8 : 1
        context.fill()
        context.stroke()
        const targetIndex = hitTargets.length
        hitTargets.push({ x: point.x, y: point.y, radius: Math.max(markerSize + 5, 8), action, label })
        if (document.activeElement === canvas && targetIndex === keyboardIndex) {
          context.beginPath()
          context.arc(point.x, point.y, markerSize + 6, 0, Math.PI * 2)
          context.strokeStyle = '#ffffff'
          context.lineWidth = 1
          context.stroke()
        }
      }

      for (const indicator of scene.indicators) {
        drawMarker(indicator, indicator.consensus >= 6 ? '#ffae62' : '#66d7c9', 3.3, scene.selectedIp === indicator.ip, () => scene.onSelect(indicator.ip), `${indicator.ip}, approximate location`)
      }
      if (scene.showEvents) {
        for (const event of scene.events) {
          drawMarker(event, '#61d7e2', 4.1, scene.selectedEventId === event.id, () => scene.onSelectEvent(event.id), `Magnitude ${event.magnitude.toFixed(1)} earthquake, ${event.place}`)
        }
      }
      if (scene.showNews) {
        for (const article of scene.news) {
          if (article.location) drawMarker(article.location, '#cf9bff', article.location.precision === 'city' ? 4 : 5, scene.selectedNewsId === article.id, () => scene.onSelectNews(article.id), `${article.location.name}: ${article.title}`)
        }
      }
      context.restore()
      context.beginPath()
      context.arc(centerX, centerY, radius, 0, Math.PI * 2)
      context.strokeStyle = 'rgba(104, 228, 164, .55)'
      context.lineWidth = 1
      context.stroke()
      context.fillStyle = '#75888a'
      context.font = '8px monospace'
      context.fillText('3D GLOBE · DRAG TO ROTATE', 16, 22)
      if (!reducedMotion.matches && dragX === null) scheduleDraw()
    }

    const pointerDown = (event) => {
      dragX = event.clientX
      canvas.setPointerCapture(event.pointerId)
      canvas.classList.add('globe-dragging')
      scheduleDraw()
    }
    const pointerMove = (event) => {
      if (dragX !== null) {
        rotation += (event.clientX - dragX) / Math.max(48, Math.min(width * 0.36, height * 0.44))
        dragX = event.clientX
      }
    }
    const pointerUp = () => {
      dragX = null
      canvas.classList.remove('globe-dragging')
      scheduleDraw()
    }
    const pointerClick = (event) => {
      if (canvas.dataset.dragged === 'true') {
        canvas.dataset.dragged = 'false'
        return
      }
      const bounds = canvas.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const target = hitTargets.find((item) => Math.hypot(item.x - x, item.y - y) <= item.radius)
      target?.action()
    }
    const pointerMoveWithDrag = (event) => {
      if (dragX !== null && Math.abs(event.clientX - dragX) > 1) canvas.dataset.dragged = 'true'
      pointerMove(event)
      if (dragX !== null) scheduleDraw()
    }
    const keyDown = (event) => {
      if (!hitTargets.length) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        keyboardIndex = (keyboardIndex + 1) % hitTargets.length
        canvas.setAttribute('aria-label', `Rotating 3D globe. Selected marker: ${hitTargets[keyboardIndex].label}. Press Enter to select; use arrow keys to cycle markers.`)
        scheduleDraw()
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        keyboardIndex = (keyboardIndex - 1 + hitTargets.length) % hitTargets.length
        canvas.setAttribute('aria-label', `Rotating 3D globe. Selected marker: ${hitTargets[keyboardIndex].label}. Press Enter to select; use arrow keys to cycle markers.`)
        scheduleDraw()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        hitTargets[keyboardIndex % hitTargets.length]?.action()
      }
    }
    const handleVisibilityChange = () => {
      if (document.hidden && frame) {
        window.cancelAnimationFrame(frame)
        frame = 0
      } else scheduleDraw()
    }
    const handleMotionPreferenceChange = () => scheduleDraw()
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMoveWithDrag)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', pointerUp)
    canvas.addEventListener('click', pointerClick)
    canvas.addEventListener('keydown', keyDown)
    canvas.addEventListener('focus', scheduleDraw)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    reducedMotion.addEventListener('change', handleMotionPreferenceChange)
    requestRedrawRef.current = scheduleDraw
    scheduleDraw()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibilityObserver?.disconnect()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMoveWithDrag)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerUp)
      canvas.removeEventListener('click', pointerClick)
      canvas.removeEventListener('keydown', keyDown)
      canvas.removeEventListener('focus', scheduleDraw)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      reducedMotion.removeEventListener('change', handleMotionPreferenceChange)
      requestRedrawRef.current = null
    }
  }, [])

  useEffect(() => {
    requestRedrawRef.current?.()
  }, [indicators, events, showEvents, news, showNews, selectedIp, selectedEventId, selectedNewsId])

  return <canvas ref={canvasRef} className="globe-map" role="application" tabIndex="0" aria-label="Rotating 3D globe. Drag to rotate; use arrow keys to cycle markers and Enter to select." aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter" />
}

function App() {
  const [activeTab, setActiveTab] = useState('Threat map')
  const [filter, setFilter] = useState('all')
  const [indicatorCategory, setIndicatorCategory] = useState('all')
  const [indicatorCountry, setIndicatorCountry] = useState('all')
  const [snapshotWindow, setSnapshotWindow] = useState('all')
  const [selectedIp, setSelectedIp] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceOpen, setSourceOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [feed, setFeed] = useState(() => loadCachedThreatFeed())
  const [threatLookupInput, setThreatLookupInput] = useState('')
  const [threatLookupResult, setThreatLookupResult] = useState(null)
  const [threatLookupError, setThreatLookupError] = useState('')
  const [threatLookupLoading, setThreatLookupLoading] = useState(false)
  const [threatLookupNotice, setThreatLookupNotice] = useState('')
  const [openPhishCache, setOpenPhishCache] = useState(() => loadCachedOpenPhishFeed())
  const [cachedVulnerabilities] = useState(() => loadCachedVulnerabilities())
  const [vulnerabilities, setVulnerabilities] = useState(cachedVulnerabilities?.vulnerabilities ?? [])
  const [vulnerabilityTotal, setVulnerabilityTotal] = useState(cachedVulnerabilities?.totalResults ?? 0)
  const [vulnerabilityCheckedAt, setVulnerabilityCheckedAt] = useState(cachedVulnerabilities?.checkedAt ?? null)
  const [vulnerabilityStale, setVulnerabilityStale] = useState(Boolean(cachedVulnerabilities))
  const [vulnerabilityError, setVulnerabilityError] = useState('')
  const [vulnerabilityLoading, setVulnerabilityLoading] = useState(false)
  const [vulnerabilityRetrySeconds, setVulnerabilityRetrySeconds] = useState(0)
  const [vulnerabilitySearch, setVulnerabilitySearch] = useState('')
  const [vulnerabilitySeverity, setVulnerabilitySeverity] = useState('all')
  const vulnerabilityLoadingRef = useRef(false)
  const vulnerabilityRetryAtRef = useRef(0)
  const [feedError, setFeedError] = useState('')
  const [feedLoading, setFeedLoading] = useState(false)
  const [geoLocations, setGeoLocations] = useState([])
  const [geoFailures, setGeoFailures] = useState(0)
  const [geoAttempted, setGeoAttempted] = useState(0)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoLastSuccessAt, setGeoLastSuccessAt] = useState(() => loadCachedGeoRetrievedAt())
  const [geoLastAttemptAt, setGeoLastAttemptAt] = useState(null)
  const [geoFreshlyResolved, setGeoFreshlyResolved] = useState(0)
  const [geoError, setGeoError] = useState('')
  const feedLoadingRef = useRef(false)
  const feedLoadPromiseRef = useRef(null)
  const [cachedEvents] = useState(() => loadCachedGlobalEvents())
  const [globalEvents, setGlobalEvents] = useState(cachedEvents?.events ?? [])
  const [eventsUpdatedAt, setEventsUpdatedAt] = useState(cachedEvents?.updatedAt ?? null)
  const [eventsRetrievedAt, setEventsRetrievedAt] = useState(cachedEvents?.retrievedAt ?? null)
  const [eventsStale, setEventsStale] = useState(cachedEvents?.stale ?? false)
  const [eventsError, setEventsError] = useState('')
  const [eventsLoading, setEventsLoading] = useState(false)
  const [showEarthquakes, setShowEarthquakes] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState(null)
  const eventsLoadingRef = useRef(false)
  const [cachedNews] = useState(() => loadCachedGlobalNews())
  const [newsArticles, setNewsArticles] = useState(cachedNews?.articles ?? [])
  const [newsUpdatedAt, setNewsUpdatedAt] = useState(cachedNews?.updatedAt ?? null)
  const [newsStale, setNewsStale] = useState(cachedNews?.stale ?? false)
  const [newsError, setNewsError] = useState('')
  const [newsLoading, setNewsLoading] = useState(false)
  const [showNews, setShowNews] = useState(true)
  const [selectedNewsId, setSelectedNewsId] = useState(null)
  const [mapView, setMapView] = useState('2d')
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [openPhishLoading, setOpenPhishLoading] = useState(false)
  const [openPhishError, setOpenPhishError] = useState('')
  const [openPhishAttempted, setOpenPhishAttempted] = useState(Boolean(openPhishCache))
  const newsLoadingRef = useRef(false)

  const refreshVulnerabilities = useCallback(async () => {
    if (vulnerabilityLoadingRef.current) return
    if (Date.now() < vulnerabilityRetryAtRef.current) return
    vulnerabilityLoadingRef.current = true
    setVulnerabilityLoading(true)
    try {
      const result = await loadVulnerabilities()
      setVulnerabilities(result.vulnerabilities)
      setVulnerabilityTotal(result.totalResults)
      setVulnerabilityCheckedAt(result.checkedAt)
      setVulnerabilityStale(false)
      setVulnerabilityError('')
      vulnerabilityRetryAtRef.current = 0
      setVulnerabilityRetrySeconds(0)
    } catch (error) {
      logClientError('nvd_refresh_failed', error)
      setVulnerabilityError(error instanceof Error ? error.message : 'Could not refresh NVD vulnerabilities.')
      setVulnerabilityStale(true)
      if (Number.isFinite(error?.retryAfterMs) && error.retryAfterMs > 0) {
        vulnerabilityRetryAtRef.current = Date.now() + error.retryAfterMs
        setVulnerabilityRetrySeconds(Math.ceil(error.retryAfterMs / 1000))
      }
    } finally {
      vulnerabilityLoadingRef.current = false
      setVulnerabilityLoading(false)
    }
  }, [])

  const refreshFeed = useCallback(async () => {
    if (feedLoadingRef.current) return feedLoadPromiseRef.current ?? null
    feedLoadingRef.current = true
    setFeedLoading(true)
    const request = (async () => {
      try {
        const result = await loadThreatFeed()
        setFeed(result)
        setFeedError('')
        return result
      } catch (error) {
        logClientError('threat_feed_refresh_failed', error)
        setFeedError(error instanceof Error ? error.message : 'Could not refresh the public threat feed.')
        setFeed((current) => current ? { ...current, stale: true } : current)
        return null
      } finally {
        feedLoadingRef.current = false
        feedLoadPromiseRef.current = null
        setFeedLoading(false)
      }
    })()
    feedLoadPromiseRef.current = request
    return request
  }, [])

  const refreshLocations = useCallback(async (indicators, feedVersion) => {
    if (!indicators?.length || !feedVersion) return
    setGeoLastAttemptAt(Date.now())
    setGeoError('')
    setGeoLoading(true)
    try {
      const result = await resolveIndicatorLocations(indicators, feedVersion)
      setGeoLocations(result.locations)
      setGeoAttempted(result.attempted)
      setGeoFailures(result.failures)
      setGeoFreshlyResolved(result.freshlyResolved)
      if (result.freshlyResolved > 0) {
        const retrievedAt = Date.now()
        recordGeoRetrievalSuccess(retrievedAt)
        setGeoLastSuccessAt(retrievedAt)
      }
      setGeoError(result.errors.length
        ? `${result.failures} of ${result.attempted} IP location requests failed: ${result.errors.join(' ')}`
        : '')
    } catch (error) {
      logClientError('geolocation_refresh_failed', error)
      setGeoFailures((count) => count + 1)
      setGeoError(error instanceof Error ? error.message : 'Could not retrieve IP geolocation data.')
    } finally {
      setGeoLoading(false)
    }
  }, [])

  const refreshGlobalEvents = useCallback(async () => {
    if (eventsLoadingRef.current) return
    eventsLoadingRef.current = true
    setEventsLoading(true)
    try {
      const result = await loadGlobalEvents()
      setGlobalEvents(result.events)
      setEventsUpdatedAt(result.updatedAt)
      setEventsRetrievedAt(result.retrievedAt)
      setEventsStale(false)
      setEventsError('')
    } catch (error) {
      logClientError('events_refresh_failed', error)
      setEventsError(error instanceof Error ? error.message : 'Could not refresh global events.')
      setEventsStale(true)
    } finally {
      eventsLoadingRef.current = false
      setEventsLoading(false)
    }
  }, [])

  const refreshNews = useCallback(async () => {
    if (newsLoadingRef.current) return
    newsLoadingRef.current = true
    setNewsLoading(true)
    try {
      const result = await loadGlobalNews()
      setNewsArticles(result.articles)
      setNewsUpdatedAt(result.updatedAt)
      setNewsStale(false)
      setNewsError('')
    } catch (error) {
      logClientError('news_refresh_failed', error)
      setNewsError(error instanceof Error ? error.message : 'Could not refresh global news.')
      setNewsStale(true)
    } finally {
      newsLoadingRef.current = false
      setNewsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshFeed()
    const timer = window.setInterval(refreshFeed, threatFeedInfo.refreshMinutes * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [refreshFeed])

  useEffect(() => {
    refreshGlobalEvents()
    const timer = window.setInterval(refreshGlobalEvents, globalEventsInfo.refreshMinutes * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [refreshGlobalEvents])

  useEffect(() => {
    refreshNews()
    const timer = window.setInterval(refreshNews, globalNewsInfo.refreshMinutes * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [refreshNews])

  useEffect(() => {
    refreshVulnerabilities()
    const timer = window.setInterval(refreshVulnerabilities, vulnerabilityIntelInfo.refreshMinutes * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [refreshVulnerabilities])

  useEffect(() => {
    if (!vulnerabilityRetrySeconds) return undefined
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((vulnerabilityRetryAtRef.current - Date.now()) / 1000))
      setVulnerabilityRetrySeconds(seconds)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [vulnerabilityRetrySeconds > 0])

  useEffect(() => {
    if (feed) refreshLocations(feed.indicators, feed.sha)
  }, [feed?.sha, refreshLocations])

  useEffect(() => {
    const updateOnlineStatus = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (!searchOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  const highCount = feed?.indicators.filter((indicator) => indicator.consensus >= 6).length ?? 0
  const mediumCount = feed ? feed.indicators.length - highCount : 0
  const availableCountries = useMemo(
    () => [...new Set(geoLocations.map((location) => location.country))].sort((first, second) => first.localeCompare(second)),
    [geoLocations],
  )
  const filteredIndicators = useMemo(() => {
    if (!feed) return []
    return filterIndicators({
      indicators: feed.indicators,
      locations: geoLocations,
      confidence: filter,
      category: indicatorCategory,
      country: indicatorCountry,
      snapshotWindow,
      publishedAt: feed.publishedAt,
      query: searchQuery,
    })
  }, [feed, filter, geoLocations, indicatorCategory, indicatorCountry, snapshotWindow, searchQuery])

  const listedIndicators = useMemo(() => {
    const firstPage = filteredIndicators.slice(0, 50)
    const selected = filteredIndicators.find((indicator) => indicator.ip === selectedIp)
    if (selected && !firstPage.some((indicator) => indicator.ip === selectedIp)) firstPage.push(selected)
    return firstPage
  }, [filteredIndicators, selectedIp])

  const visibleLocations = useMemo(() => {
    const matches = new Set(filteredIndicators.map((indicator) => indicator.ip))
    return geoLocations.filter((location) => matches.has(location.ip))
  }, [filteredIndicators, geoLocations])

  const filteredVulnerabilities = useMemo(() => {
    const query = vulnerabilitySearch.trim().toLowerCase()
    return vulnerabilities.filter((vulnerability) => {
      if (vulnerabilitySeverity !== 'all' && vulnerability.metrics.severity !== vulnerabilitySeverity) return false
      if (!query) return true
      const affected = vulnerability.affectedProducts
        .map((product) => `${product.vendor} ${product.product} ${product.versionRange}`)
        .join(' ')
      return `${vulnerability.id} ${vulnerability.description} ${affected}`
        .toLowerCase()
        .includes(query)
    })
  }, [vulnerabilities, vulnerabilitySearch, vulnerabilitySeverity])

  const threatTrends = useMemo(() => buildThreatTrendModel(
    feed?.activity ?? [],
    feed?.indicators ?? [],
    geoLocations,
    vulnerabilities,
    geoAttempted,
  ), [feed?.activity, feed?.indicators, geoLocations, vulnerabilities, geoAttempted])

  const sourceHealthRows = useMemo(() => buildSourceHealthRows({
    online,
    threat: {
      count: feed?.indicators.length ?? 0,
      attempted: Boolean(feed || feedLoading || feedError),
      lastSuccessAt: feed?.checkedAt ?? feed?.retrievedAt ?? null,
      latestUpdateAt: feed?.publishedAt ?? null,
      loading: feedLoading,
      stale: Boolean(feed?.stale),
      error: feedError,
    },
    geolocation: {
      resolved: geoLocations.length,
      attempted: geoAttempted,
      attemptedRequest: Boolean(geoLastAttemptAt),
      freshlyResolved: geoFreshlyResolved,
      lastSuccessAt: geoLastSuccessAt,
      loading: geoLoading,
      stale: Boolean(geoLocations.length && (geoFailures > 0 || !geoLastSuccessAt || geoFreshlyResolved === 0)),
      error: geoError,
    },
    events: {
      count: globalEvents.length,
      attempted: Boolean(cachedEvents || eventsRetrievedAt || eventsError || eventsLoading),
      lastSuccessAt: eventsRetrievedAt,
      latestUpdateAt: eventsUpdatedAt,
      loading: eventsLoading,
      stale: eventsStale,
      error: eventsError,
    },
    news: {
      count: newsArticles.length,
      attempted: Boolean(cachedNews || newsUpdatedAt || newsError || newsLoading),
      lastSuccessAt: newsUpdatedAt,
      latestUpdateAt: newsArticles.reduce((latest, article) => Math.max(latest, article.publishedAt), 0) || null,
      loading: newsLoading,
      stale: newsStale,
      error: newsError,
    },
    vulnerabilities: {
      count: vulnerabilities.length,
      attempted: Boolean(cachedVulnerabilities || vulnerabilityCheckedAt || vulnerabilityError || vulnerabilityLoading),
      lastSuccessAt: vulnerabilityCheckedAt,
      latestUpdateAt: vulnerabilities.reduce((latest, vulnerability) => Math.max(latest, vulnerability.publishedAt ?? 0), 0) || null,
      loading: vulnerabilityLoading,
      stale: vulnerabilityStale,
      error: vulnerabilityError,
    },
    phishing: {
      count: openPhishCache?.urls.length ?? 0,
      lastSuccessAt: openPhishCache?.retrievedAt ?? null,
      attempted: openPhishAttempted,
      loading: openPhishLoading,
      stale: Boolean(openPhishCache?.stale),
      error: openPhishError,
    },
  }), [
    online, feed, feedLoading, feedError, geoLocations, geoAttempted, geoLastAttemptAt, geoFreshlyResolved, geoLastSuccessAt, geoLoading, geoFailures, geoError,
    globalEvents.length, eventsRetrievedAt, eventsUpdatedAt, eventsLoading, eventsStale, eventsError,
    newsArticles, newsUpdatedAt, newsLoading, newsStale, newsError,
    vulnerabilities, vulnerabilityCheckedAt, vulnerabilityLoading, vulnerabilityStale, vulnerabilityError,
    openPhishCache, openPhishAttempted, openPhishLoading, openPhishError,
  ])

  const navigateTo = (tab) => {
    setActiveTab(tab.label)
    document.getElementById(tab.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const exportIndicators = () => {
    if (!feed) return
    const rows = [['IP address', 'Minimum source-list consensus', 'Approximate city', 'Approximate country', 'ASN organization']]
    for (const indicator of filteredIndicators) {
      const location = geoLocations.find((item) => item.ip === indicator.ip)
      rows.push([indicator.ip, `${indicator.consensus}+`, location?.city ?? '', location?.country ?? '', location?.organization ?? ''])
    }
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const downloadUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = 'sentinel-threat-indicators.csv'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  }

  const refreshOpenPhishFeed = async (force = false) => {
    setOpenPhishAttempted(true)
    setOpenPhishLoading(true)
    setOpenPhishError('')
    try {
      const snapshot = await loadOpenPhishFeed({ force })
      setOpenPhishCache(snapshot)
      setOpenPhishError(snapshot.error ?? '')
      return snapshot
    } catch (error) {
      setOpenPhishError(error instanceof Error ? error.message : 'Could not retrieve the OpenPhish feed.')
      throw error
    } finally {
      setOpenPhishLoading(false)
    }
  }

  const refreshSource = (sourceId) => {
    switch (sourceId) {
      case 'ipsum': return refreshFeed()
      case 'geoip': return feed && refreshLocations(feed.indicators, feed.sha)
      case 'usgs': return refreshGlobalEvents()
      case 'bbc': return refreshNews()
      case 'nvd': return refreshVulnerabilities()
      case 'openphish': return refreshOpenPhishFeed(true).catch(() => null)
      default: throw new Error(`Unsupported data source: ${sourceId}`)
    }
  }

  const handleThreatLookup = async (event) => {
    event.preventDefault()
    const validation = validateThreatLookupInput(threatLookupInput)
    setThreatLookupNotice('')
    if (!validation.valid) {
      setThreatLookupResult(null)
      setThreatLookupError(validation.error)
      return
    }

    setThreatLookupError('')
    setThreatLookupResult(null)
    setThreatLookupLoading(true)
    try {
      if (validation.type === 'ip') {
        const snapshot = feed ?? await refreshFeed()
        if (!snapshot) throw new Error('Could not retrieve the IPsum feed; see Source health for details.')
        setThreatLookupResult({ query: validation.value, type: 'ip', data: findIpReputation(validation.value, snapshot) })
      } else {
        const snapshot = await refreshOpenPhishFeed()
        setThreatLookupResult({ query: validation.value, type: 'domain', data: findDomainReports(validation.value, snapshot) })
      }
    } catch (error) {
      logClientError('threat_lookup_failed', error)
      setThreatLookupError(error instanceof Error ? error.message : 'Could not complete the lookup. Try again later.')
    } finally {
      setThreatLookupLoading(false)
    }
  }

  const copyThreatLookup = async () => {
    if (!threatLookupResult) return
    try {
      await navigator.clipboard.writeText(serializeThreatLookup(threatLookupResult).content)
      setThreatLookupNotice('JSON findings copied to clipboard.')
    } catch (error) {
      logClientError('threat_lookup_copy_failed', error)
      setThreatLookupNotice('Clipboard access was unavailable. Use Export JSON instead.')
    }
  }

  const exportThreatLookup = (format) => {
    if (!threatLookupResult) return
    const file = serializeThreatLookup(threatLookupResult, format)
    const downloadUrl = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }))
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `threat-lookup-${threatLookupResult.type}.${file.extension}`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  }

  const selectIndicator = (ip) => {
    setSelectedIp(ip)
    window.requestAnimationFrame(() => {
      document.getElementById(`indicator-${ip}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const selectNews = (article) => {
    setSelectedNewsId(selectedNewsId === article.id ? null : article.id)
    if (!article.location) return
    setShowNews(true)
    document.getElementById('threat-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Sentinel home" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark"><span /></span>
          <span className="brand-name">sentinel<span className="brand-period">.</span><small>THREAT INTELLIGENCE</small></span>
        </a>

        <div className="workspace-switch">
          <span className="workspace-avatar">N</span>
          <span className="workspace-copy"><strong>Northstar Security</strong><small>Public intelligence view</small></span>
          <span className="workspace-caret">⌄</span>
        </div>

        <div className="nav-label">MONITOR</div>
        <nav className="primary-nav" aria-label="Dashboard sections">
          {tabs.map((tab) => (
            <button className={`nav-item ${activeTab === tab.label ? 'active' : ''}`} key={tab.label} onClick={() => navigateTo(tab)} aria-current={activeTab === tab.label ? 'location' : undefined}>
              <Icon name={tab.icon} /><span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="nav-label intel-label">INTELLIGENCE</div>
        <button className="nav-item subdued" onClick={() => navigateTo(tabs.find((tab) => tab.target === 'source-health-panel'))}><span className="nav-mini-icon">◈</span><span>Feed sources</span></button>
        <button className="nav-item subdued" onClick={exportIndicators}><Icon name="download" /><span>Export indicators</span></button>

        <div className="sidebar-spacer" />
        <div className="plan-card">
          <div className="plan-card-top"><span className="plan-icon">✳</span><span className="plan-status">PUBLIC</span></div>
          <strong>Feed health</strong>
          <p>IPsum publishes a refreshed reputation feed about <b>once every 24 hours.</b></p>
          <div className="coverage-caption"><span>Publisher check</span><b>15 min</b></div>
        </div>
        <button className="nav-item settings-link" onClick={refreshFeed}><Icon name="clock" /><span>Refresh intelligence</span></button>
        <div className="profile">
          <span className="profile-avatar">IP</span>
          <span className="profile-copy"><strong>Public indicators</strong><small>No private network telemetry</small></span>
          <span className="profile-menu">···</span>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Monitor</span><Icon name="chevron" size={14} /><strong>{activeTab}</strong></div>
          <div className="topbar-actions">
            <span className={`system-health ${feedError ? 'system-warning' : ''}`}><i />{feedError ? 'Feed needs attention' : feedLoading ? 'Checking public feed' : feed?.stale ? 'Cached feed data' : feed ? 'Public feed connected' : 'Connecting to public feed'}</span>
            <span className="topbar-divider" />
            <button className="icon-button" aria-label="Search threat indicators" aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setNotificationOpen(false) }}><Icon name="search" /></button>
            <button className="icon-button notification-button" aria-label="Threat feed status" aria-expanded={notificationOpen} onClick={() => { setNotificationOpen(!notificationOpen); setSearchOpen(false) }}><Icon name="bell" />{feedError && <i />}</button>
            <a className="help-button" href={threatFeedInfo.repository} target="_blank" rel="noreferrer">Feed documentation <Icon name="arrow" size={13} /></a>
          </div>
          {searchOpen && <div className="search-popover"><Icon name="search" size={16} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Search threat indicators" placeholder="Search an IP, country, city, or ASN..." /><kbd>ESC</kbd><button onClick={() => { setSearchOpen(false); setSearchQuery('') }} aria-label="Close search">×</button></div>}
          {notificationOpen && <div className="feed-popover" role="status"><strong>{feedError ? 'Threat feed warning' : 'Threat feed status'}</strong><span>{feedError || (feed ? `Latest source list published ${formatDate(feed.publishedAt)}.` : 'Waiting for source data.')}</span><span>Checked: {formatDate(feed?.checkedAt)}</span><button onClick={refreshFeed} disabled={feedLoading}>{feedLoading ? 'Checking…' : 'Check now'}</button></div>}
        </header>

        <div className="dashboard-content">
          <div className="page-heading" id="overview">
            <div>
              <div className="eyebrow"><span className={feedError ? 'status-dot status-warning' : 'live-dot'} /> PUBLIC THREAT INTELLIGENCE</div>
              <h1>Suspicious IP indicators<span>.</span></h1>
              <p className="page-subtitle">Multi-source reputation intelligence, refreshed from its publisher daily.</p>
            </div>
            <button className="range-button refresh-button" onClick={refreshFeed} disabled={feedLoading}><Icon name="clock" size={15} />{feedLoading ? 'Checking feed…' : 'Refresh intelligence'}</button>
          </div>

          <div className="reality-banner"><span className="info-mark">i</span><span><strong>This is threat intelligence, not real-time incident telemetry.</strong> IPsum aggregates 30+ public blocklists and updates daily. A listed IP is not proof of an active attack on your network.</span></div>
          {feedError && <div className="feed-error" role="alert"><strong>Feed refresh failed.</strong> {feedError} {feed && 'Showing the last successful cached snapshot.'}<button onClick={refreshFeed} disabled={feedLoading}>Retry</button></div>}

          <section className="stats-grid" aria-label="Public threat feed statistics">
            <article className="stat-card"><div className="stat-label">CORROBORATED INDICATORS <span className="stat-icon green-icon">◎</span></div><div className="stat-value">{feed ? formatNumber(feed.indicators.length) : '—'}</div><div className="stat-foot"><span className="change-positive">3+ independent lists</span><span>in the current feed</span></div></article>
            <article className="stat-card"><div className="stat-label">STRONG CONSENSUS <span className="stat-icon red-icon">⌁</span></div><div className="stat-value">{feed ? formatNumber(highCount) : '—'}</div><div className="stat-foot"><span className="change-alert">6+ source lists</span><span>higher corroboration</span></div></article>
            <article className="stat-card"><div className="stat-label">APPROXIMATE LOCATIONS <span className="stat-icon cyan-icon">⌖</span></div><div className="stat-value">{geoLoading ? '…' : `${geoLocations.length}/${geoAttempted || threatFeedInfo.geoLookupLimit}`}</div><div className="stat-foot"><span>Sample across both tiers</span><span>IP GeoIP, not attack origin</span></div></article>
            <article className="stat-card"><div className="stat-label">SOURCE LAST UPDATED <span className="stat-icon green-icon">◷</span></div><div className="stat-value freshness-value">{feed ? new Date(feed.publishedAt).toISOString().slice(0, 10) : '—'}</div><div className="stat-foot"><span>{feed?.stale ? 'Cached snapshot' : 'Publisher date (UTC)'}</span><span>checks every 15 min</span></div></article>
          </section>

          <section className="map-panel" id="threat-map">
            <div className="panel-heading map-heading">
              <div><h2>Threat intelligence &amp; global events</h2><p>Separate layers: approximate IP hosting locations, news areas, and USGS earthquakes</p></div>
              <div className="map-heading-actions">
                <div className={`feed-badge ${feed?.stale || feedError ? 'badge-stale' : ''}`}><span className={feedError ? 'status-dot status-warning' : 'live-dot'} />{feedLoading ? 'CHECKING' : feed?.stale ? 'CACHED' : 'PUBLIC FEED'}</div>
                <div className="map-view-toggle" role="group" aria-label="Threat map view">
                  <button className={mapView === '2d' ? 'selected' : ''} aria-pressed={mapView === '2d'} onClick={() => setMapView('2d')}>2D Map</button>
                  <button className={mapView === '3d' ? 'selected' : ''} aria-pressed={mapView === '3d'} onClick={() => setMapView('3d')}>3D Globe</button>
                </div>
                <button className="map-menu" aria-label="Threat intelligence source options" aria-expanded={sourceOpen} onClick={() => setSourceOpen(!sourceOpen)}>···</button>
                {sourceOpen && <div className="map-options"><strong>Intelligence sources</strong><a href={threatFeedInfo.repository} target="_blank" rel="noreferrer">IPsum · public blocklists <Icon name="arrow" size={12} /></a><a href={threatFeedInfo.geolocationProvider} target="_blank" rel="noreferrer">ipapi.co · IP GeoIP <Icon name="arrow" size={12} /></a><button onClick={exportIndicators}>Export filtered indicators (.csv)</button><span>Public indicator data can be stale and may contain false positives.</span></div>}
              </div>
            </div>
            <div className="map-filter-row">
              <div className="consensus-filter-group" role="group" aria-label="Filter indicators by source-list consensus">
              {consensusFilters.map((option) => <button key={option.id} className={`filter-chip ${filter === option.id ? 'selected' : ''}`} aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.id === 'high' ? <i className="confidence-dot high" /> : option.id === 'medium' ? <i className="confidence-dot medium" /> : <span className="filter-total">{feed ? formatNumber(filteredIndicators.length) : '—'}</span>}{option.label}</button>)}
              </div>
              <button className={`filter-chip event-filter ${showEarthquakes ? 'selected' : ''}`} aria-pressed={showEarthquakes} onClick={() => setShowEarthquakes((current) => !current)}><i className="event-legend-dot" />Earthquakes {eventsLoading ? '…' : globalEvents.length ? `${globalEvents.length}` : ''}</button>
              <button className={`filter-chip news-filter ${showNews ? 'selected' : ''}`} aria-pressed={showNews} onClick={() => setShowNews((current) => !current)}><i className="news-legend-dot" />World news {newsLoading ? '…' : newsArticles.length ? `${newsArticles.length}` : ''}</button>
              <span className="map-filter-spacer" />
              <span className="map-updated">{newsUpdatedAt ? `News checked ${formatNewsTime(newsUpdatedAt)}${newsStale ? ' · cached' : ''}` : newsLoading ? 'Loading world news…' : 'World news unavailable'}</span>
            </div>
            <div className="news-headline-strip" aria-label="Latest mapped world news">
              <div className="news-strip-heading"><span><i className="news-legend-dot" />WORLD NEWS</span><a href="#news-panel">All headlines ↓</a></div>
              {newsArticles.some((article) => article.location) ? (() => {
                const mappedHeadlines = newsArticles.filter((article) => article.location).slice(0, 3);
                return (
                  <div className="news-headline-viewport">
                    <div className="news-headline-track">
                      <div className="news-headline-group">
                        {mappedHeadlines.map((article) => (
                          <button className={`news-headline-card ${selectedNewsId === article.id ? 'news-headline-selected' : ''}`} key={article.id} onClick={() => selectNews(article)} aria-pressed={selectedNewsId === article.id}>
                            <span className="news-headline-place">{article.location.name}</span>
                            <strong>{article.title}</strong>
                            <span className="news-headline-time">{formatNewsTime(article.publishedAt)} UTC · BBC</span>
                          </button>
                        ))}
                      </div>
                      <div className="news-headline-group news-headline-copy" aria-hidden="true">
                        {mappedHeadlines.map((article) => (
                          <div className="news-headline-card" key={article.id}>
                            <span className="news-headline-place">{article.location.name}</span>
                            <strong>{article.title}</strong>
                            <span className="news-headline-time">{formatNewsTime(article.publishedAt)} UTC · BBC</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })() : <span className="news-strip-empty">{newsLoading ? 'Loading mapped headlines…' : 'No headlines with confidently matched locations are available.'}</span>}
            </div>
            <div className="map-stage">{visibleLocations.length || (showEarthquakes && globalEvents.length) || (showNews && newsArticles.some((article) => article.location)) ? mapView === '3d' ? <GlobeMap indicators={visibleLocations} events={globalEvents} showEvents={showEarthquakes} news={newsArticles} showNews={showNews} selectedIp={selectedIp} selectedEventId={selectedEventId} selectedNewsId={selectedNewsId} onSelect={selectIndicator} onSelectEvent={setSelectedEventId} onSelectNews={setSelectedNewsId} /> : <WorldMap indicators={visibleLocations} events={globalEvents} showEvents={showEarthquakes} news={newsArticles} showNews={showNews} selectedIp={selectedIp} selectedEventId={selectedEventId} selectedNewsId={selectedNewsId} onSelect={selectIndicator} onSelectEvent={setSelectedEventId} onSelectNews={setSelectedNewsId} /> : <div className="map-empty">{newsError ? `Global news unavailable: ${newsError}` : newsLoading ? 'Loading global news…' : eventsLoading ? 'Loading global events…' : geoLoading ? 'Resolving approximate IP locations…' : 'No indicators or global events are available to display.'}</div>}</div>
            <div className="map-footer"><div className="legend"><span className="legend-title">MAP KEY</span><span><i className="confidence-dot high" /> 6+ source lists</span><span><i className="confidence-dot medium" /> 3-5 source lists</span><span><i className="event-legend-dot" /> USGS earthquake</span><span><i className="news-legend-dot" /> BBC news area</span></div><span className="map-disclaimer">News areas are approximate headline place matches.</span></div>
          </section>

          <section className="events-panel news-panel" id="news-panel" aria-labelledby="news-title">
            <div className="panel-heading events-heading">
              <div><h2 id="news-title">Major world news</h2><p>BBC World headlines · highlighted only when a location is identified in the story text</p></div>
              <div className="events-heading-actions">
                <span>{newsUpdatedAt ? `${newsStale ? 'Cached' : 'Checked'} ${formatNewsTime(newsUpdatedAt)} UTC` : newsLoading ? 'Loading headlines…' : 'Feed unavailable'}</span>
                <button onClick={refreshNews} disabled={newsLoading}>{newsLoading ? 'Checking…' : 'Refresh news'}</button>
              </div>
            </div>
            {newsError && <div className="events-error" role="alert">Could not refresh BBC World news: {newsError}{newsArticles.length > 0 && ' Showing the last successful results.'}</div>}
            <p className="news-location-note">Map areas are approximate matches against locations explicitly mentioned in each headline or summary; they do not show verified event boundaries. Some headlines may not have a mappable location.</p>
            <div className="news-list">
              {newsArticles.length ? newsArticles.slice(0, 8).map((article) => (
                <article className={`news-story ${selectedNewsId === article.id ? 'news-story-selected' : ''}`} key={article.id}>
                  <button className="news-story-select" onClick={() => selectNews(article)} aria-pressed={selectedNewsId === article.id}>
                    <span className="news-story-content">
                      <strong>{article.title}</strong>
                      <span>{article.summary || 'Open the publisher article for more details.'}</span>
                      <small>{article.location ? `Approx. area: ${article.location.name} · matched in ${article.locationBasis}` : 'No location confidently identified in this headline'}</small>
                      <small>{formatNewsTime(article.publishedAt)} UTC</small>
                    </span>
                  </button>
                  <a href={article.url} target="_blank" rel="noreferrer">BBC ↗</a>
                </article>
              )) : <div className="events-empty">{newsLoading ? 'Loading headlines from BBC World…' : newsError ? 'World news could not be loaded. Retry to check the feed.' : 'No recent world headlines are available.'}</div>}
            </div>
            <div className="news-source"><span>Source: <a href={globalNewsInfo.source} target="_blank" rel="noreferrer">BBC News World</a> · Updated every 15 minutes</span><span>Headlines are independently reported news, not threat intelligence.</span></div>
          </section>

          <section className="events-panel" aria-labelledby="events-title">
            <div className="panel-heading events-heading">
              <div><h2 id="events-title">Global events · earthquakes M4.5+</h2><p>USGS past-day feed · events are separate from cyber threat indicators</p></div>
              <div className="events-heading-actions">
                <span>{eventsUpdatedAt ? `${eventsStale ? 'Cached · last update' : 'Feed updated'} ${formatEventTime(eventsUpdatedAt)} UTC` : eventsLoading ? 'Loading events…' : 'Feed unavailable'}</span>
                <button onClick={refreshGlobalEvents} disabled={eventsLoading}>{eventsLoading ? 'Checking…' : 'Refresh events'}</button>
              </div>
            </div>
            {eventsError && <div className="events-error" role="alert">Could not refresh global events: {eventsError}{globalEvents.length > 0 && ' Showing the last successful results.'}</div>}
            <div className="events-list">
              {globalEvents.length ? globalEvents.slice(0, 8).map((event) => (
                <article className={`global-event ${selectedEventId === event.id ? 'global-event-selected' : ''}`} key={event.id}>
                  <button className="global-event-select" onClick={() => { setSelectedEventId(selectedEventId === event.id ? null : event.id); setShowEarthquakes(true) }} aria-pressed={selectedEventId === event.id}>
                    <span className="event-magnitude">M{event.magnitude.toFixed(1)}</span>
                    <span className="event-description"><strong>{event.place}</strong><small>{formatEventTime(event.occurredAt)} UTC{event.depth === null ? '' : ` · ${event.depth.toFixed(0)} km depth`}</small></span>
                  </button>
                  {event.url && <a href={event.url} target="_blank" rel="noreferrer" aria-label={`View USGS details for magnitude ${event.magnitude.toFixed(1)} earthquake at ${event.place}`}>USGS ↗</a>}
                </article>
              )) : <div className="events-empty">{eventsLoading ? 'Loading recent earthquakes from USGS…' : eventsError ? 'Global events could not be loaded. Retry to check the USGS feed.' : 'No M4.5+ earthquakes reported in the past day.'}</div>}
            </div>
          </section>

          <section className="events-panel threat-timeline" id="activity-timeline" aria-labelledby="activity-timeline-title">
            <div className="panel-heading events-heading">
              <div><h2 id="activity-timeline-title">Threat activity timeline</h2><p>IPsum snapshot changes compared by this browser</p></div>
              <span className="timeline-source-badge">{feed?.stale ? 'CACHED SNAPSHOT' : 'PUBLIC SOURCE'}</span>
            </div>
            <p className="timeline-disclaimer">IPsum does not provide per-IP first-seen or observation timestamps. “Newly listed” means present in this snapshot but absent from the previous snapshot cached here; it does not mean a newly active threat. The first available snapshot is a baseline, not invented history.</p>
            <div className="timeline-list">
              {feed?.activity?.length ? [...feed.activity].reverse().map((activity) => (
                <article className="timeline-entry" key={activity.id}>
                  <div className="timeline-entry-heading">
                    <span className={`timeline-marker ${activity.baseline ? 'timeline-marker-baseline' : ''}`} />
                    <div><h3>{activity.baseline ? 'Baseline snapshot loaded' : 'IPsum publisher snapshot updated'}</h3><p>{activity.source} · source revision <code>{activity.id.slice(0, 8)}</code></p></div>
                    <a href={activity.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>
                  </div>
                  <div className="timeline-timestamps">
                    <span>Provider published <strong>{formatDate(activity.publishedAt)}</strong></span>
                    <span>{activity.dashboardTimestampType === 'retrieved' ? 'Dashboard retrieved' : 'Dashboard last checked'} <strong>{formatDate(activity.retrievedAt)}</strong></span>
                  </div>
                  <div className="timeline-counts">
                    <span><strong>{formatNumber(activity.totalCount)}</strong> current indicators</span>
                    {activity.baseline
                      ? <span>Prior local snapshot unavailable; changes are not inferred.</span>
                      : <>
                        <span><strong>{formatNumber(activity.newlyListed.count)}</strong> newly listed since previous snapshot</span>
                        <span><strong>{formatNumber(activity.retained.count)}</strong> remained listed</span>
                        <span><strong>{formatNumber(activity.noLongerListed.count)}</strong> no longer listed</span>
                        {activity.strengthened.count > 0 && <span><strong>{formatNumber(activity.strengthened.count)}</strong> moved from 3+ to 6+ list consensus</span>}
                      </>}
                  </div>
                  {!activity.baseline && <div className="timeline-change-groups">
                    {[
                      ['Newly listed in this snapshot', activity.newlyListed],
                      ['Previously known and still listed', activity.retained],
                      ['No longer present in this snapshot', activity.noLongerListed],
                      ['Consensus increased to 6+ lists', activity.strengthened],
                    ].filter(([, summary]) => summary.count > 0).map(([label, summary]) => (
                      <details className="timeline-change-group" key={label}>
                        <summary>{label} · showing {formatNumber(summary.sample.length)} of {formatNumber(summary.count)}</summary>
                        <ul>{summary.sample.map((indicator) => <li key={indicator.ip}><code>{indicator.ip}</code><span>{indicator.consensus}+ source lists</span></li>)}</ul>
                      </details>
                    ))}
                  </div>}
                  <p className="timeline-source-note">Source publication time describes the IPsum snapshot. The dashboard timestamp records when this browser checked or retrieved it; neither is an individual IP observation time.</p>
                </article>
              )) : <div className="events-empty">{feedLoading ? 'Checking IPsum for a published snapshot…' : feedError ? 'No cached snapshot history is available. Retry to establish a baseline.' : 'No IPsum snapshot is available yet.'}</div>}
            </div>
          </section>

          <section className="events-panel threat-trends-panel" id="trend-analytics" aria-labelledby="threat-trends-title">
            <div className="panel-heading events-heading">
              <div><h2 id="threat-trends-title">Historical trends &amp; statistics</h2><p>Collected publisher revisions and current public-feed coverage</p></div>
              <span className="timeline-source-badge">{threatTrends.snapshotCount} LOCAL SNAPSHOT{threatTrends.snapshotCount === 1 ? '' : 'S'}</span>
            </div>
            <p className="trend-disclaimer">Historical charts use only distinct IPsum revisions this browser actually retrieved (up to the latest eight). They do not backfill gaps or represent per-IP observation dates. Location counts describe approximate IP hosting locations in the current GeoIP sample; they do not identify an attacker or indicate attack origin. World news and earthquakes remain separate and are excluded from cyber-intelligence counts.</p>
            <div className="trend-metrics">
              <article><span>COLLECTED REVISIONS</span><strong>{formatNumber(threatTrends.snapshotCount)}</strong><small>{threatTrends.snapshotCount > 1 ? 'Enough for a revision-to-revision comparison' : threatTrends.snapshotCount === 1 ? 'One baseline; comparison unavailable' : 'No collected snapshot history yet'}</small></article>
              <article><span>INDICATORS IN LATEST SNAPSHOT</span><strong>{threatTrends.latest ? formatNumber(threatTrends.latest.totalCount) : '—'}</strong><small>{threatTrends.latest ? `Published ${formatDate(threatTrends.latest.publishedAt)}` : 'IPsum feed not available'}</small></article>
              <article><span>CHANGE VS PREVIOUS REVISION</span><strong>{threatTrends.latest && threatTrends.latest.totalChange !== null ? formatSignedNumber(threatTrends.latest.totalChange) : '—'}</strong><small>{threatTrends.comparisonAvailable ? `${formatNumber(threatTrends.latest.newlyListed.count)} newly listed · ${formatNumber(threatTrends.latest.noLongerListed.count)} no longer listed` : 'Requires at least two collected revisions'}</small></article>
              <article><span>CURRENT GEOIP SAMPLE</span><strong>{formatNumber(threatTrends.countryCoverage.resolvedIndicators)} / {formatNumber(threatTrends.countryCoverage.attemptedIndicators)}</strong><small>Resolved / attempted · current feed only</small></article>
            </div>
            <div className="trend-content-grid">
              <article className="trend-data-card trend-history-card">
                <div className="trend-card-heading"><div><h3>Reported indicators by collected revision</h3><p>Source publication date shown on the axis; exact publisher and dashboard times are below.</p></div><a href={threatFeedInfo.repository} target="_blank" rel="noreferrer">IPsum source ↗</a></div>
                {threatTrends.snapshots.length
                  ? <ThreatTrendChart snapshots={threatTrends.snapshots} />
                  : <div className="trend-empty">{feedLoading ? 'Waiting for the first IPsum revision…' : 'No real snapshot history is available yet. A baseline will appear after the first successful feed retrieval.'}</div>}
                {threatTrends.snapshots.length === 1 && <p className="trend-history-note">This single point is the locally observed baseline; no historical comparison is inferred.</p>}
                {threatTrends.snapshots.length > 0 && <details className="trend-snapshot-details">
                  <summary>Recorded source and dashboard timestamps · {threatTrends.snapshotCount} revisions</summary>
                  <div className="trend-snapshot-table-wrap"><table className="trend-snapshot-table">
                    <thead><tr><th>Source published</th><th>Retrieved by dashboard</th><th>Indicators</th><th>6+ lists</th><th>Net change</th></tr></thead>
                    <tbody>{[...threatTrends.snapshots].reverse().map((snapshot) => (
                      <tr key={snapshot.id}>
                        <td>{formatDate(snapshot.publishedAt)}</td><td>{formatDate(snapshot.retrievedAt)}</td>
                        <td>{formatNumber(snapshot.totalCount)}</td><td>{formatNumber(snapshot.highCount)}</td>
                        <td>{snapshot.totalChange === null ? 'Baseline' : formatSignedNumber(snapshot.totalChange)}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </details>}
              </article>
              <article className="trend-data-card trend-activity-card">
                <div className="trend-card-heading"><div><h3>Latest revision activity</h3><p>Changes observed between successive public feed revisions</p></div></div>
                {threatTrends.latest && threatTrends.previous ? (
                  <div className="trend-activity-stats">
                    <div><span>Newly listed</span><strong>+{formatNumber(threatTrends.latest.newlyListed.count)}</strong></div>
                    <div><span>No longer listed</span><strong>−{formatNumber(threatTrends.latest.noLongerListed.count)}</strong></div>
                    <div><span>Moved to 6+ consensus</span><strong>{formatSignedNumber(threatTrends.latest.highChange)}</strong></div>
                    <div><span>Total indicators</span><strong>{formatSignedNumber(threatTrends.latest.totalChange)}</strong></div>
                  </div>
                ) : <div className="trend-empty">Activity change counts require two distinct collected IPsum revisions. A publisher revision is not evidence of a newly active attack.</div>}
                <p className="trend-panel-note">Newly listed and removed counts compare feed membership across these collected snapshots only. They do not establish when an indicator first appeared upstream or whether it affected a network.</p>
              </article>
              <article className="trend-data-card">
                <div className="trend-card-heading"><div><h3>Categories in available feeds</h3><p>Source-provided classifications; unlike records are not combined</p></div></div>
                <div className="trend-category-block">
                  <div className="trend-category-label"><span>IPsum · {feed?.stale ? 'cached ' : ''}IP reputation indicators</span><strong>{formatNumber(threatTrends.categories.ipReputationCount)}</strong></div>
                  <p>IPsum supplies reputation and source-list consensus, not malware family or attack type.</p>
                </div>
                <div className="trend-category-block">
                  <div className="trend-category-label"><span>NVD · {vulnerabilityStale ? 'cached ' : ''}fetched CVEs by CVSS severity</span><strong>{formatNumber(threatTrends.categories.vulnerabilityCount)}</strong></div>
                  {threatTrends.categories.vulnerabilitySeverities.length
                    ? <ul className="trend-severity-list">{threatTrends.categories.vulnerabilitySeverities.map(({ severity, count }) => <li key={severity}><span>{severity}</span><strong>{formatNumber(count)}</strong></li>)}</ul>
                    : <p>No scored or fetched NVD CVE records are currently available.</p>}
                  <p>CVE severity is vulnerability metadata, not observed attack activity.</p>
                </div>
              </article>
              <article className="trend-data-card">
                <div className="trend-card-heading"><div><h3>Countries associated with current indicators</h3><p>Approximate IP hosting locations · sampled and resolved only</p></div></div>
                {threatTrends.countryCoverage.countries.length
                  ? <ul className="trend-country-list">{threatTrends.countryCoverage.countries.map(({ country, count }) => (
                    <li key={country}><span>{country}</span><span className="trend-country-bar"><i style={{ width: `${count / threatTrends.countryCoverage.countries[0].count * 100}%` }} /></span><strong>{formatNumber(count)}</strong></li>
                  ))}</ul>
                  : <div className="trend-empty">{geoLoading ? 'Resolving approximate locations for a limited indicator sample…' : 'No current sampled indicators have a resolved country location.'}</div>}
                <p className="trend-panel-note">Counts are current sampled indicators, not unique attacks or attribution. GeoIP describes approximate IP hosting location and may be missing or inaccurate.</p>
              </article>
            </div>
          </section>

          <section className="events-panel source-health-panel" id="source-health-panel" aria-labelledby="source-health-title">
            <div className="panel-heading events-heading">
              <div><h2 id="source-health-title">Data source health</h2><p>Retrieval status, last success, source update times, and stale-data warnings</p></div>
              <span className={`source-online-badge ${online ? 'online' : 'offline'}`}><i />{online ? 'BROWSER ONLINE' : 'BROWSER OFFLINE'}</span>
            </div>
            <p className="source-health-disclaimer">A successful check is not necessarily a new source update. “Last successful retrieval” is tracked separately from the publisher’s update timestamp. OpenPhish is fetched only on request; GeoIP timestamps are available only for successful provider requests recorded by this browser.</p>
            <div className="source-health-grid">
              {sourceHealthRows.map((source) => {
                const sourceStatusLabel = {
                  loading: 'Retrieving',
                  ready: 'Retrieved successfully',
                  empty: 'Retrieved · no records',
                  idle: 'Not checked',
                  stale: 'Cached · may be stale',
                  error: 'Retrieval failed',
                  offline: 'Browser offline',
                }[source.status]
                const lastSuccess = source.lastSuccessAt
                  ? formatDate(source.lastSuccessAt)
                  : source.hasData ? 'Retrieval time not recorded' : source.attempted ? 'No successful retrieval recorded' : 'Not checked yet'
                const currentRows = source.id === 'ipsum' ? feed?.indicators.length
                  : source.id === 'geoip' ? geoLocations.length
                    : source.id === 'usgs' ? globalEvents.length
                      : source.id === 'bbc' ? newsArticles.length
                        : source.id === 'nvd' ? vulnerabilities.length
                          : openPhishCache?.urls.length
                return (
                  <article className={`source-health-card source-status-${source.status}`} key={source.id}>
                    <div className="source-health-card-heading">
                      <div><h3>{source.name}</h3><p>{source.description}</p></div>
                      <span className="source-status-badge"><i />{sourceStatusLabel}</span>
                    </div>
                    <div className="source-health-details">
                      <div><span>LAST SUCCESSFUL RETRIEVAL / CHECK</span><strong>{lastSuccess}</strong></div>
                      <div><span>{source.latestUpdateLabel.toUpperCase()}</span><strong>{source.latestUpdateAt ? formatDate(source.latestUpdateAt) : source.latestUpdateLabel.includes('not supplied') ? 'Not provided by source' : 'Not available in latest response'}</strong></div>
                      <div><span>DISPLAYED RECORDS</span><strong>{source.hasData ? `${formatNumber(currentRows ?? source.count)}${source.stale ? ' · cached' : ''}` : source.loading ? 'Waiting for response' : source.status === 'empty' ? '0 · successful empty response' : source.status === 'stale' ? 'No records in last successful snapshot · may be stale' : 'No records available'}</strong></div>
                    </div>
                    {source.error && <p className={`source-health-error ${source.status === 'offline' ? 'is-offline' : ''}`} role="status">{source.error}</p>}
                    <div className="source-health-footer">
                      <a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.id === 'openphish' ? 'Provider information' : 'Source details'} ↗</a>
                      <button onClick={() => refreshSource(source.refresh)} disabled={!online || source.loading || (source.id === 'geoip' && !feed) || (source.id === 'nvd' && vulnerabilityRetrySeconds > 0)}>{source.loading ? 'Checking…' : source.id === 'nvd' && vulnerabilityRetrySeconds > 0 ? `Retry in ${vulnerabilityRetrySeconds}s` : source.id === 'openphish' ? 'Refresh feed' : source.id === 'geoip' ? 'Resolve sample' : 'Check now'}</button>
                    </div>
                  </article>
                )
              })}
            </div>
            <p className="source-health-footnote">World news is retrieved through the rss2json converter. IPsum and NVD provide publisher timestamps; USGS provides feed-generation time. BBC article publication time is shown as the newest included article, not a feed-generation timestamp.</p>
          </section>

          <section className="events-panel learning-panel" id="learning-mode" aria-labelledby="learning-title">
            <div className="panel-heading events-heading">
              <div><h2 id="learning-title">Cybersecurity learning mode</h2><p>Plain-language guide to the data and terms used in this dashboard</p></div>
              <span className="timeline-source-badge">DEFENSIVE BASICS</span>
            </div>
            <p className="learning-intro">Threat feeds are useful clues, not verdicts. Use them to decide what to investigate next, then verify findings with trustworthy sources and your own device or organization’s security records.</p>
            <div className="learning-grid">
              <article className="learning-card">
                <span className="learning-step">01 · FOUNDATIONS</span>
                <h3>What is threat intelligence?</h3>
                <p>Threat intelligence is information about potential or observed cyber risks—such as suspicious IP addresses, phishing websites, malicious software, or attacker techniques—collected from sources and given context so people can make defensive decisions.</p>
                <p><strong>Example:</strong> several independent blocklists report an IP address. That makes the address worth checking against your logs; it does not show that the address contacted your network.</p>
                <a href="https://www.cisa.gov/topics/cyber-threats-and-advisories" target="_blank" rel="noreferrer">CISA · Cyber threats and advisories ↗</a>
              </article>
              <article className="learning-card">
                <span className="learning-step">02 · INDICATORS</span>
                <h3>What does a malicious IP indicator mean?</h3>
                <p>An IP indicator is a network address associated by a source with suspicious or harmful activity. Addresses can be reassigned, shared by many users, used by cloud providers, or incorrectly listed.</p>
                <p><strong>Example:</strong> a listed address might belong to a server that was abused last week—or to shared hosting. Check the source, time, and your own logs before blocking or drawing conclusions. A GeoIP country identifies an approximate hosting location, not a person or attacker.</p>
                <a href="https://www.cisa.gov/news-events/cybersecurity-advisories" target="_blank" rel="noreferrer">CISA · Advisories and indicators ↗</a>
              </article>
              <article className="learning-card">
                <span className="learning-step">03 · COMMON CATEGORIES</span>
                <h3>Common threat-intelligence categories</h3>
                <ul className="learning-list">
                  <li><strong>Phishing:</strong> messages or websites designed to trick people into sharing information or opening harmful content.</li>
                  <li><strong>Malware:</strong> software intended to disrupt devices, steal information, or enable unauthorized access.</li>
                  <li><strong>Command and control (C2):</strong> infrastructure malware may contact to receive instructions or send data.</li>
                  <li><strong>Scanning / brute force:</strong> repeated attempts to discover exposed services or guess account credentials.</li>
                  <li><strong>Vulnerability:</strong> a weakness in software or hardware that could be misused.</li>
                </ul>
                <p>This dashboard’s IPsum feed reports IP reputation and source-list counts only; it does not assign those attack categories to each IP.</p>
                <a href="https://attack.mitre.org/" target="_blank" rel="noreferrer">MITRE ATT&amp;CK · Adversary tactics and techniques ↗</a>
              </article>
              <article className="learning-card">
                <span className="learning-step">04 · READING THE SCORES</span>
                <h3>Confidence, consensus, and severity</h3>
                <p><strong>IPsum consensus</strong> is how many contributing lists include an address: this dashboard shows 3+ and 6+ tiers. More independent listings can strengthen a reputation signal, but do not prove a real attack or guarantee that every source is correct.</p>
                <p><strong>CVSS severity</strong> describes the technical severity of a vulnerability under a scoring standard. It is not the probability your device is affected, evidence that it was exploited, or an incident-confidence score. Prioritize using your actual software inventory, exposure, and vendor guidance.</p>
                <a href="https://www.first.org/cvss/" target="_blank" rel="noreferrer">FIRST · CVSS severity scoring ↗</a>
              </article>
              <article className="learning-card learning-card-wide">
                <span className="learning-step">05 · THREE DIFFERENT THINGS</span>
                <h3>Indicator vs. vulnerability vs. confirmed incident</h3>
                <div className="learning-comparison">
                  <div><span className="learning-term">INDICATOR</span><p>A clue reported by an intelligence source, such as an IP or phishing URL. It suggests something to check.</p></div>
                  <div><span className="learning-term">VULNERABILITY</span><p>A documented weakness in a product or configuration, often tracked as a CVE. It matters if your systems are affected and exposed.</p></div>
                  <div><span className="learning-term">CONFIRMED INCIDENT</span><p>An event supported by evidence from relevant logs, endpoint/network telemetry, investigation, or a trusted incident-response team.</p></div>
                </div>
                <p className="learning-callout"><strong>In this dashboard:</strong> IPsum and OpenPhish provide public reputation indicators; NVD provides vulnerability records. None is connected to your devices or network, so none can confirm an incident here.</p>
                <a href="https://www.nist.gov/cyberframework" target="_blank" rel="noreferrer">NIST · Cybersecurity Framework and risk management ↗</a>
              </article>
              <article className="learning-card">
                <span className="learning-step">06 · FOR EVERYONE</span>
                <h3>Defensive steps for individuals</h3>
                <ul className="learning-list">
                  <li>Use a password manager and unique passwords; turn on multi-factor authentication where available.</li>
                  <li>Install operating-system, browser, and app updates from official sources.</li>
                  <li>Pause before opening unexpected links or attachments; verify unusual requests through a known contact method.</li>
                  <li>Keep important files backed up and know how to report a suspicious message or account activity.</li>
                </ul>
                <a href="https://www.cisa.gov/secure-our-world" target="_blank" rel="noreferrer">CISA · Secure Our World ↗</a>
              </article>
              <article className="learning-card">
                <span className="learning-step">07 · FOR ORGANIZATIONS</span>
                <h3>Defensive steps for teams</h3>
                <ul className="learning-list">
                  <li>Inventory assets and prioritize fixes using exposure, business impact, and vendor remediation advice.</li>
                  <li>Correlate indicators with authorized DNS, proxy, firewall, identity, and endpoint logs before taking action.</li>
                  <li>Validate indicator source, age, confidence, and likely false positives; use controls proportionately.</li>
                  <li>Maintain tested backups, least-privilege access, incident-response contacts, and a documented escalation plan.</li>
                </ul>
                <a href="https://www.cisa.gov/cross-sector-cybersecurity-performance-goals" target="_blank" rel="noreferrer">CISA · Cybersecurity Performance Goals ↗</a>
              </article>
            </div>
            <p className="learning-footer">Learning links open authoritative external references. Guidance is general education, not a substitute for your organization’s security policy or incident-response procedures.</p>
          </section>

          <section className="events-panel threat-search-panel" id="threat-search-panel" aria-labelledby="threat-search-title">
            <div className="panel-heading events-heading">
              <div><h2 id="threat-search-title">Threat intelligence search</h2><p>Check an IPv4 address or domain against supported public feeds</p></div>
              <span className="timeline-source-badge">{openPhishCache ? 'DOMAIN CACHE AVAILABLE' : 'PUBLIC SOURCES'}</span>
            </div>
            <p className="threat-search-disclaimer">Defensive reputation lookup only: this checks public snapshots and never connects to, resolves, scans, or probes the submitted host. A listing is not proof of an active attack or compromise, and no match is not proof of safety.</p>
            <p className="threat-search-terms" role="note">OpenPhish Community Feed terms allow personal, academic, or independent research only. Organizational business/security use requires prior written consent. <a href="https://openphish.com/terms.html" target="_blank" rel="noreferrer">Review current terms ↗</a></p>
            <form className="threat-search-form" onSubmit={handleThreatLookup}>
              <label htmlFor="threat-search-input">IPv4 address, domain, or http/https URL</label>
              <div className="threat-search-controls">
                <input id="threat-search-input" type="search" autoCapitalize="none" autoCorrect="off" spellCheck="false" value={threatLookupInput} onChange={(event) => setThreatLookupInput(event.target.value)} placeholder="203.0.113.10 or example.com" aria-describedby="threat-search-help" />
                <button type="submit" disabled={threatLookupLoading}>{threatLookupLoading ? 'Checking public feed…' : 'Check indicator'}</button>
              </div>
              <span id="threat-search-help">IPv4 checks IPsum reputation; domains check OpenPhish’s public community feed. IPv6 is not supported.</span>
            </form>
            {threatLookupError && <div className="events-error" role="alert">{threatLookupError}</div>}
            {threatLookupResult && (
              <div className="threat-lookup-result" aria-live="polite">
                <div className="threat-result-heading">
                  <div><span className={`threat-result-status ${(threatLookupResult.data.found ?? (threatLookupResult.data.matches?.length > 0)) ? 'is-listed' : 'not-listed'}`}>
                    {(threatLookupResult.data.found ?? (threatLookupResult.data.matches?.length > 0)) ? 'LISTED IN SNAPSHOT' : 'NO MATCH IN SNAPSHOT'}
                  </span><h3><code>{threatLookupResult.query}</code></h3></div>
                  <div className="threat-result-actions">
                    <button onClick={copyThreatLookup}>Copy JSON</button>
                    <button onClick={() => exportThreatLookup('json')}>Export JSON</button>
                    <button onClick={() => exportThreatLookup('csv')}>Export CSV</button>
                  </div>
                </div>
                {threatLookupNotice && <p className="threat-search-notice" role="status">{threatLookupNotice}</p>}
                {threatLookupResult.type === 'ip' ? (
                  <>
                    <p className="threat-result-source">Source: <a href={threatLookupResult.data.sourceUrl} target="_blank" rel="noreferrer">IPsum public blocklist aggregation ↗</a></p>
                    {threatLookupResult.data.found && <p className="threat-result-consensus">{threatLookupResult.data.consensus}+ source lists in the current IPsum snapshot</p>}
                    {threatLookupResult.data.stale && <p className="threat-search-notice">Using a cached IPsum snapshot; the latest publisher check failed or is not available.</p>}
                    <div className="threat-result-times">
                      <span>Provider snapshot published<strong>{formatDate(threatLookupResult.data.publishedAt)}</strong></span>
                      <span>Dashboard feed check<strong>{formatDate(threatLookupResult.data.checkedAt)}</strong></span>
                      <span>Per-IP report time<strong>Not provided by IPsum</strong></span>
                    </div>
                    <p className="threat-search-disclaimer result-disclaimer">IPsum supplies aggregated IP reputation, not individual incident reports. Its snapshot time is not an observation time for this IP.</p>
                  </>
                ) : (
                  <>
                    <p className="threat-result-source">Source: <a href={threatLookupResult.data.sourceUrl} target="_blank" rel="noreferrer">OpenPhish Community Feed ↗</a></p>
                    <div className="threat-result-times">
                      <span>Dashboard feed retrieval<strong>{formatDate(threatLookupResult.data.retrievedAt)}</strong></span>
                      <span>Individual report times<strong>Not provided in this feed</strong></span>
                    </div>
                    {threatLookupResult.data.error && <div className="events-error" role="status">Could not refresh OpenPhish ({threatLookupResult.data.error}); results below use a cached feed retrieved at {formatDate(threatLookupResult.data.retrievedAt)}.</div>}
                    {threatLookupResult.data.stale && !threatLookupResult.data.error && <p className="threat-search-notice">Showing a cached OpenPhish snapshot retrieved at {formatDate(threatLookupResult.data.retrievedAt)}.</p>}
                    <div className="threat-match-list">
                      {threatLookupResult.data.matches.length
                        ? <><strong>Showing up to {threatSearchInfo.maxMatches} matching URL indicator{threatLookupResult.data.matches.length === 1 ? '' : 's'}</strong><ul>{threatLookupResult.data.matches.map((match) => <li key={match}><code>{match}</code><span>Report time unavailable</span></li>)}</ul></>
                        : <p>No matching host was present in the checked OpenPhish snapshot. Feed absence does not establish that a domain is safe.</p>}
                    </div>
                    <p className="threat-search-disclaimer result-disclaimer">Matched URLs are displayed as text, not linked, to avoid accidentally opening a reported phishing destination. Matching a subdomain includes its full parent-domain boundary, not lookalike suffixes.</p>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="events-panel vulnerability-panel" id="vulnerability-panel" aria-labelledby="vulnerability-title">
            <div className="panel-heading events-heading">
              <div><h2 id="vulnerability-title">Vulnerability intelligence</h2><p>Recent CVEs published by NVD · not matched against installed assets</p></div>
              <div className="events-heading-actions">
                <span>{vulnerabilityCheckedAt ? `${vulnerabilityStale ? 'Cached · checked' : 'Checked'} ${formatDate(vulnerabilityCheckedAt)}` : vulnerabilityLoading ? 'Loading NVD…' : 'Feed not checked'}</span>
                <button onClick={refreshVulnerabilities} disabled={vulnerabilityLoading || vulnerabilityRetrySeconds > 0}>{vulnerabilityLoading ? 'Checking…' : vulnerabilityRetrySeconds > 0 ? `Retry in ${vulnerabilityRetrySeconds}s` : 'Refresh CVEs'}</button>
              </div>
            </div>
            <p className="vulnerability-disclaimer">A CVE listing does not establish that your systems use an affected product or version. NVD data is public vulnerability information, not evidence of exploitation or a security incident in this environment. Product/version coverage may be incomplete or unavailable.</p>
            {vulnerabilityError && <div className="events-error" role="alert">Could not refresh NVD: {vulnerabilityError}{vulnerabilities.length > 0 && ' Showing the last successful cached results.'}</div>}
            <div className="vulnerability-controls">
              <label className="vulnerability-search">Search CVEs, descriptions, vendors, products, versions
                <input type="search" value={vulnerabilitySearch} onChange={(event) => setVulnerabilitySearch(event.target.value)} placeholder="e.g. CVE-2026-1234 or vendor / product" />
              </label>
              <label>CVSS severity
                <select value={vulnerabilitySeverity} onChange={(event) => setVulnerabilitySeverity(event.target.value)}>
                  <option value="all">All severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="NONE">None</option>
                  <option value="UNKNOWN">Not scored</option>
                </select>
              </label>
            </div>
            <div className="vulnerability-results-summary">
              <span>{formatNumber(filteredVulnerabilities.length)} shown · {formatNumber(vulnerabilityTotal)} NVD results in the last {vulnerabilityIntelInfo.queryWindowDays} days</span>
              {vulnerabilityTotal > vulnerabilities.length && <span>Latest {formatNumber(vulnerabilities.length)} fetched · use the NVD source link for complete results</span>}
            </div>
            <div className="vulnerability-list">
              {filteredVulnerabilities.length ? filteredVulnerabilities.map((vulnerability) => (
                <article className="vulnerability-card" key={vulnerability.id}>
                  <div className="vulnerability-card-heading">
                    <div><a className="vulnerability-id" href={vulnerability.sourceUrl} target="_blank" rel="noreferrer">{vulnerability.id} ↗</a>
                      {vulnerability.status && <span className="vulnerability-status">{vulnerability.status}</span>}</div>
                    <span className={`cvss-badge severity-${vulnerability.metrics.severity.toLowerCase()}`}>
                      {vulnerability.metrics.score === null ? 'CVSS N/A' : `${vulnerability.metrics.severity} · ${vulnerability.metrics.score.toFixed(1)}`}
                      {vulnerability.metrics.version && <small>CVSS {vulnerability.metrics.version}</small>}
                    </span>
                  </div>
                  <p className="vulnerability-description">{vulnerability.description}</p>
                  <div className="vulnerability-dates">
                    <span>Published <strong>{formatVulnerabilityDate(vulnerability.publishedAt)}</strong></span>
                    <span>Modified <strong>{formatVulnerabilityDate(vulnerability.modifiedAt)}</strong></span>
                  </div>
                  <details className="vulnerability-details">
                    <summary>Products, version ranges &amp; remediation references</summary>
                    <div className="vulnerability-detail-body">
                      <div><h3>Affected products / versions listed by NVD</h3>
                        {vulnerability.affectedProducts.length
                          ? <ul>{vulnerability.affectedProducts.map((product, index) => <li key={`${product.vendor}-${product.product}-${index}`}><strong>{product.vendor} / {product.product}</strong><span>{product.versionRange}</span></li>)}</ul>
                          : <p>NVD did not provide affected product configurations for this record.</p>}
                      </div>
                      <div><h3>Remediation guidance &amp; vendor advisories</h3>
                        {vulnerability.remediationReferences.length
                          ? <ul>{vulnerability.remediationReferences.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.tags.join(', ') || 'Advisory or patch'} ↗</a></li>)}</ul>
                          : <p>No vendor advisory, patch, or mitigation reference was tagged by NVD. Check the CVE and vendor sources before acting.</p>}
                      </div>
                      {vulnerability.metrics.vector && <p className="cvss-vector">CVSS vector: <code>{vulnerability.metrics.vector}</code></p>}
                    </div>
                  </details>
                  <div className="vulnerability-card-footer"><span>Source: NVD</span>
                    <div>{vulnerability.references.filter((reference) => !vulnerability.remediationReferences.some((remediation) => remediation.url === reference.url)).slice(0, 3).map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">Reference ↗</a>)}</div>
                  </div>
                </article>
              )) : <div className="events-empty">{vulnerabilityLoading && !vulnerabilities.length ? 'Loading recent vulnerabilities from NVD…' : vulnerabilityError && !vulnerabilities.length ? 'NVD is unavailable and there is no cached vulnerability snapshot.' : vulnerabilitySearch || vulnerabilitySeverity !== 'all' ? 'No CVEs match the current search and severity filters.' : vulnerabilityTotal > 0 ? 'NVD returned results, but none included the minimum CVE fields required for display.' : 'NVD reported no published CVEs for the selected recent window.'}</div>}
            </div>
            <div className="vulnerability-source"><a href={vulnerabilityIntelInfo.source} target="_blank" rel="noreferrer">NVD CVE database ↗</a><span>Public API · {vulnerabilityIntelInfo.queryWindowDays}-day publication window · refreshes every {vulnerabilityIntelInfo.refreshMinutes / 60} hours · up to {vulnerabilityIntelInfo.resultsPerPage} newest results</span></div>
          </section>

          <section className="bottom-grid">
            <article className="bottom-card trend-card" id="source-panel">
              <div className="panel-heading compact-heading"><div><h2>Source corroboration</h2><p>Public list overlap, not an incident severity score</p></div><a className="subtle-select" href={threatFeedInfo.repository} target="_blank" rel="noreferrer">View source <Icon name="arrow" size={12} /></a></div>
              <div className="confidence-breakdown">
                <div className="confidence-row"><span><i className="confidence-dot high" /> 6+ independent lists</span><strong>{feed ? formatNumber(highCount) : '—'}</strong></div>
                <div className="confidence-track"><span style={{ width: `${feed?.indicators.length ? (highCount / feed.indicators.length) * 100 : 0}%` }} /></div>
                <div className="confidence-row"><span><i className="confidence-dot medium" /> 3-5 independent lists</span><strong>{feed ? formatNumber(mediumCount) : '—'}</strong></div>
                <div className="confidence-track confidence-track-medium"><span style={{ width: `${feed?.indicators.length ? (mediumCount / feed.indicators.length) * 100 : 0}%` }} /></div>
                <p>Higher overlap is stronger reputation evidence, but still does not confirm malicious activity against any particular network.</p>
              </div>
            </article>
            <article className="bottom-card response-card">
              <div className="panel-heading compact-heading"><div><h2>Feed freshness &amp; scope</h2><p>What these public indicators can tell you</p></div><span className="response-health">DAILY SOURCE</span></div>
              <div className="freshness-details">
                <div><span>UPSTREAM PUBLISHED</span><strong>{formatDate(feed?.publishedAt)}</strong></div>
                <div><span>LAST CHECKED HERE</span><strong>{formatDate(feed?.checkedAt)}</strong></div>
                <p>This feed has no per-IP observation times and is not a live event stream. Use your SIEM, firewall, or EDR telemetry to identify actual events on your network.</p>
              </div>
            </article>
          </section>
        </div>
      </section>

      <aside className="activity-sidebar">
        <div className="activity-header" id="indicator-panel">
          <div className="activity-title-row"><h2>Threat indicators</h2><span className="activity-count">{formatNumber(feed?.indicators.length ?? 0)}</span><button className="activity-more" aria-label="Export threat indicators" onClick={exportIndicators}><Icon name="download" size={15} /></button></div>
          <p><span className={feedError ? 'status-dot status-warning' : 'live-dot'} />{feedLoading ? 'Checking IPsum feed' : feed?.stale ? 'Cached public intelligence' : 'Public blocklist intelligence'}</p>
        </div>
        <div className="activity-summary"><span><i className="confidence-dot high" /><b>{formatNumber(highCount)}</b> 6+ lists</span><span><i className="confidence-dot medium" /><b>{formatNumber(mediumCount)}</b> 3-5 lists</span></div>
        <div className="indicator-filters" aria-label="Threat indicator filters">
          <label>Category
            <select value={indicatorCategory} onChange={(event) => setIndicatorCategory(event.target.value)}>
              <option value="all">All categories</option>
              <option value="ip-reputation">Suspicious IP reputation</option>
            </select>
          </label>
          <label>Approximate country
            <select value={indicatorCountry} onChange={(event) => setIndicatorCountry(event.target.value)}>
              <option value="all">All countries</option>
              <option value="unavailable">Location unavailable</option>
              {availableCountries.map((country) => <option key={country} value={country}>{country}</option>)}
            </select>
          </label>
          <label>Feed snapshot published
            <select value={snapshotWindow} onChange={(event) => setSnapshotWindow(event.target.value)}>
              <option value="all">Any date</option>
              <option value="7d">Within 7 days</option>
              <option value="30d">Within 30 days</option>
            </select>
          </label>
          <p>IPsum gives each indicator the same feed publication date; it does not provide per-IP first-seen or last-seen dates. Country filtering covers only indicators with successful GeoIP results (up to 16 sampled IPs).</p>
        </div>
        <div className="activity-list">
          {filteredIndicators.length ? listedIndicators.map((indicator) => {
            const location = geoLocations.find((item) => item.ip === indicator.ip)
            return (
              <button className={`incident ${selectedIp === indicator.ip ? 'incident-selected' : ''}`} id={`indicator-${indicator.ip}`} key={indicator.ip} onClick={() => setSelectedIp(selectedIp === indicator.ip ? null : indicator.ip)} aria-expanded={selectedIp === indicator.ip}>
                <span className={`incident-indicator ${indicator.consensus >= 6 ? 'orange' : 'yellow'}`}><span /></span>
                <span className="incident-content">
                  <span className="incident-meta"><span className={`severity-text ${indicator.consensus >= 6 ? 'high' : 'medium'}`}>{indicator.consensus}+ SOURCE MATCH</span><span className="incident-time">IP REPUTATION</span></span>
                  <strong>{indicator.ip}</strong>
                  <span className="incident-route"><span>{location ? `${location.city ? `${location.city}, ` : ''}${location.country}` : 'Approximate location unavailable'}</span></span>
                  {selectedIp === indicator.ip && <span className="incident-detail">
                    <span><b>Category</b> Suspicious IP reputation</span>
                    <span><b>Source</b> IPsum public blocklists</span>
                    <span><b>Confidence</b> {indicator.consensus}+ independent source lists</span>
                    <span><b>Approximate location</b> {location ? `${location.city ? `${location.city}, ` : ''}${location.country}` : 'Unavailable for this indicator'}</span>
                    {location?.organization && <span><b>Network</b> {location.organization}</span>}
                    <span><b>Feed snapshot</b> Published {formatDate(feed?.publishedAt)} · no per-IP observation time is available</span>
                    <span><b>Last checked</b> {formatDate(feed?.checkedAt)}</span>
                    <span>Reputation intelligence is not proof of an active attack; GeoIP is not an attack origin.</span>
                  </span>}
                </span>
              </button>
            )
          }) : <div className="empty-activity">{feedLoading ? 'Loading the public threat feed…' : feedError && !feed ? 'Threat indicators are unavailable until the feed can be loaded.' : indicatorCountry === 'unavailable' ? 'No indicators without an approximate location match your filters.' : indicatorCountry !== 'all' ? `No sampled indicators match ${indicatorCountry}.` : snapshotWindow !== 'all' ? 'No indicators match the selected feed snapshot date.' : searchQuery ? 'No indicators match your search.' : 'No indicators in this confidence tier.'}</div>}
        </div>
        <div className="indicator-list-footer">{filteredIndicators.length > 50 ? `Showing first 50${listedIndicators.length > 50 ? ' plus selected indicator' : ''} of ${formatNumber(filteredIndicators.length)} matches.` : `${formatNumber(filteredIndicators.length)} matching indicators.`}</div>
        <div className="activity-divider" />
        <div className="sensor-heading"><div><h3>Sampled IP locations</h3><p>Approximate GeoIP, not sensors</p></div><button onClick={() => feed && refreshLocations(feed.indicators, feed.sha)} disabled={geoLoading || !feed} aria-label="Refresh sampled IP locations">{geoLoading ? '…' : '↻'}</button></div>
        <div className="sensor-list">
          {geoLocations.slice(0, 8).map((location) => <button className="sensor-row" key={location.ip} onClick={() => selectIndicator(location.ip)}><span className="sensor-pip" /><span className="sensor-region"><strong>{location.city ? `${location.city}, ` : ''}{location.country}</strong><small>{location.ip}</small></span><span className="sensor-health">{location.consensus}+</span></button>)}
          {!geoLocations.length && <div className="geo-empty">{geoLoading ? 'Resolving a small sample of IPs…' : geoFailures ? 'Some IP locations could not be resolved. Retry to try again.' : 'No approximate locations available.'}</div>}
        </div>
        <div className="sensor-foot"><span>{geoFailures ? `${geoFailures} location lookups failed` : 'Approximate third-party GeoIP'}</span><button onClick={() => feed && refreshLocations(feed.indicators, feed.sha)} disabled={geoLoading || !feed} aria-label="Retry IP geolocation">↻</button></div>
        <div className="activity-footer"><Icon name="clock" size={13} /> Daily-updated IPsum · checked every 15 min</div>
      </aside>
    </main>
  )
}

export default App
