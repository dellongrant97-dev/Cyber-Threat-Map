import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import landShapes from './landShapes.js'
import {
  loadCachedThreatFeed,
  loadThreatFeed,
  resolveIndicatorLocations,
  threatFeedInfo,
} from './threatIntel.js'
import { globalEventsInfo, loadGlobalEvents } from './globalEvents.js'
import { globalNewsInfo, loadGlobalNews } from './globalNews.js'

const tabs = [
  { label: 'Overview', icon: 'grid', target: 'overview' },
  { label: 'Threat map', icon: 'radar', target: 'threat-map' },
  { label: 'Indicators', icon: 'alert', target: 'indicator-panel' },
  { label: 'Intelligence', icon: 'pulse', target: 'source-panel' },
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

function formatDate(value) {
  if (!value) return 'Waiting for source'
  return `${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))} UTC`
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

function GlobeMap({ indicators, events, showEvents, news, showNews, selectedIp, selectedEventId, selectedNewsId, onSelect, onSelectEvent, onSelectNews }) {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  sceneRef.current = { indicators, events, showEvents, news, showNews, selectedIp, selectedEventId, selectedNewsId, onSelect, onSelectEvent, onSelectNews }

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return undefined

    const landPath = new Path2D(landShapes)
    const landDots = []
    for (let latitude = -88; latitude <= 88; latitude += 2.5) {
      for (let longitude = -178; longitude <= 178; longitude += 2.5) {
        const mapX = ((longitude + 180) / 360) * 1000
        const mapY = ((90 - latitude) / 180) * 500
        if (context.isPointInPath(landPath, mapX, mapY)) landDots.push({ latitude, longitude })
      }
    }

    let width = 0
    let height = 0
    let frame = 0
    let lastTime = 0
    let rotation = -0.25
    let dragX = null
    let hitTargets = []
    let keyboardIndex = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const resizeObserver = new ResizeObserver(([entry]) => {
      const bounds = entry.contentRect
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = bounds.width
      height = bounds.height
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    })
    resizeObserver.observe(canvas)

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
      frame = window.requestAnimationFrame(draw)
    }

    const pointerDown = (event) => {
      dragX = event.clientX
      canvas.setPointerCapture(event.pointerId)
      canvas.classList.add('globe-dragging')
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
    }
    const keyDown = (event) => {
      if (!hitTargets.length) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        keyboardIndex = (keyboardIndex + 1) % hitTargets.length
        canvas.setAttribute('aria-label', `Rotating 3D globe. Selected marker: ${hitTargets[keyboardIndex].label}. Press Enter to select; use arrow keys to cycle markers.`)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        keyboardIndex = (keyboardIndex - 1 + hitTargets.length) % hitTargets.length
        canvas.setAttribute('aria-label', `Rotating 3D globe. Selected marker: ${hitTargets[keyboardIndex].label}. Press Enter to select; use arrow keys to cycle markers.`)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        hitTargets[keyboardIndex % hitTargets.length]?.action()
      }
    }
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMoveWithDrag)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', pointerUp)
    canvas.addEventListener('click', pointerClick)
    canvas.addEventListener('keydown', keyDown)
    frame = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMoveWithDrag)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerUp)
      canvas.removeEventListener('click', pointerClick)
      canvas.removeEventListener('keydown', keyDown)
    }
  }, [])

  return <canvas ref={canvasRef} className="globe-map" role="application" tabIndex="0" aria-label="Rotating 3D globe. Drag to rotate; use arrow keys to cycle markers and Enter to select." aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter" />
}

function App() {
  const [activeTab, setActiveTab] = useState('Threat map')
  const [filter, setFilter] = useState('all')
  const [selectedIp, setSelectedIp] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceOpen, setSourceOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [feed, setFeed] = useState(() => loadCachedThreatFeed())
  const [feedError, setFeedError] = useState('')
  const [feedLoading, setFeedLoading] = useState(false)
  const [geoLocations, setGeoLocations] = useState([])
  const [geoFailures, setGeoFailures] = useState(0)
  const [geoAttempted, setGeoAttempted] = useState(0)
  const [geoLoading, setGeoLoading] = useState(false)
  const feedLoadingRef = useRef(false)
  const [globalEvents, setGlobalEvents] = useState([])
  const [eventsUpdatedAt, setEventsUpdatedAt] = useState(null)
  const [eventsError, setEventsError] = useState('')
  const [eventsLoading, setEventsLoading] = useState(false)
  const [showEarthquakes, setShowEarthquakes] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState(null)
  const eventsLoadingRef = useRef(false)
  const [newsArticles, setNewsArticles] = useState([])
  const [newsUpdatedAt, setNewsUpdatedAt] = useState(null)
  const [newsError, setNewsError] = useState('')
  const [newsLoading, setNewsLoading] = useState(false)
  const [showNews, setShowNews] = useState(true)
  const [selectedNewsId, setSelectedNewsId] = useState(null)
  const [mapView, setMapView] = useState('2d')
  const newsLoadingRef = useRef(false)

  const refreshFeed = useCallback(async () => {
    if (feedLoadingRef.current) return
    feedLoadingRef.current = true
    setFeedLoading(true)
    try {
      setFeed(await loadThreatFeed())
      setFeedError('')
    } catch (error) {
      console.error('Could not refresh the public IPsum threat feed.', error)
      setFeedError(error instanceof Error ? error.message : 'Could not refresh the public threat feed.')
      setFeed((current) => current ? { ...current, stale: true } : current)
    } finally {
      feedLoadingRef.current = false
      setFeedLoading(false)
    }
  }, [])

  const refreshLocations = useCallback(async (indicators, feedVersion) => {
    if (!indicators?.length || !feedVersion) return
    setGeoLoading(true)
    try {
      const result = await resolveIndicatorLocations(indicators, feedVersion)
      setGeoLocations(result.locations)
      setGeoAttempted(result.attempted)
      setGeoFailures(result.failures)
    } catch (error) {
      console.error('Could not resolve IP indicator locations.', error)
      setGeoFailures((count) => count + 1)
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
      setEventsError('')
    } catch (error) {
      console.error('Could not refresh the USGS global-events feed.', error)
      setEventsError(error instanceof Error ? error.message : 'Could not refresh global events.')
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
      setNewsError('')
    } catch (error) {
      console.error('Could not refresh the BBC World news feed.', error)
      setNewsError(error instanceof Error ? error.message : 'Could not refresh global news.')
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
    if (!feed) return undefined
    let cancelled = false
    setGeoLoading(true)
    resolveIndicatorLocations(feed.indicators, feed.sha)
      .then((result) => {
        if (cancelled) return
        setGeoLocations(result.locations)
        setGeoAttempted(result.attempted)
        setGeoFailures(result.failures)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Could not resolve IP indicator locations.', error)
        setGeoFailures((count) => count + 1)
      })
      .finally(() => { if (!cancelled) setGeoLoading(false) })
    return () => { cancelled = true }
  }, [feed?.sha])

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
  const filteredIndicators = useMemo(() => {
    if (!feed) return []
    const query = searchQuery.trim().toLowerCase()
    return feed.indicators.filter((indicator) => {
      if (filter === 'high' && indicator.consensus < 6) return false
      if (filter === 'medium' && indicator.consensus >= 6) return false
      if (!query) return true
      const location = geoLocations.find((item) => item.ip === indicator.ip)
      return [indicator.ip, location?.country, location?.countryCode, location?.city, location?.organization]
        .some((value) => value?.toLowerCase().includes(query))
    })
  }, [feed, filter, geoLocations, searchQuery])

  const visibleLocations = useMemo(() => {
    const matches = new Set(filteredIndicators.map((indicator) => indicator.ip))
    return geoLocations.filter((location) => matches.has(location.ip))
  }, [filteredIndicators, geoLocations])

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

  const selectIndicator = (ip) => {
    setSelectedIp(ip)
    document.getElementById(`indicator-${ip}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
        <button className="nav-item subdued" onClick={() => navigateTo(tabs[3])}><span className="nav-mini-icon">◈</span><span>Feed sources</span></button>
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
              {consensusFilters.map((option) => <button key={option.id} className={`filter-chip ${filter === option.id ? 'selected' : ''}`} onClick={() => setFilter(option.id)}>{option.id === 'high' ? <i className="confidence-dot high" /> : option.id === 'medium' ? <i className="confidence-dot medium" /> : <span className="filter-total">{feed ? formatNumber(filteredIndicators.length) : '—'}</span>}{option.label}</button>)}
              </div>
              <button className={`filter-chip event-filter ${showEarthquakes ? 'selected' : ''}`} aria-pressed={showEarthquakes} onClick={() => setShowEarthquakes((current) => !current)}><i className="event-legend-dot" />Earthquakes {eventsLoading ? '…' : globalEvents.length ? `${globalEvents.length}` : ''}</button>
              <button className={`filter-chip news-filter ${showNews ? 'selected' : ''}`} aria-pressed={showNews} onClick={() => setShowNews((current) => !current)}><i className="news-legend-dot" />World news {newsLoading ? '…' : newsArticles.length ? `${newsArticles.length}` : ''}</button>
              <span className="map-filter-spacer" />
              <span className="map-updated">{newsUpdatedAt ? `News checked ${formatNewsTime(newsUpdatedAt)}` : newsLoading ? 'Loading world news…' : 'World news unavailable'}</span>
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
                <span>{newsUpdatedAt ? `Checked ${formatNewsTime(newsUpdatedAt)} UTC` : newsLoading ? 'Loading headlines…' : 'Feed unavailable'}</span>
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
                <span>{eventsUpdatedAt ? `Feed updated ${formatEventTime(eventsUpdatedAt)} UTC` : eventsLoading ? 'Loading events…' : 'Feed unavailable'}</span>
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
        <div className="activity-list">
          {filteredIndicators.length ? filteredIndicators.slice(0, 50).map((indicator) => {
            const location = geoLocations.find((item) => item.ip === indicator.ip)
            return (
              <button className={`incident ${selectedIp === indicator.ip ? 'incident-selected' : ''}`} id={`indicator-${indicator.ip}`} key={indicator.ip} onClick={() => setSelectedIp(selectedIp === indicator.ip ? null : indicator.ip)} aria-expanded={selectedIp === indicator.ip}>
                <span className={`incident-indicator ${indicator.consensus >= 6 ? 'orange' : 'yellow'}`}><span /></span>
                <span className="incident-content">
                  <span className="incident-meta"><span className={`severity-text ${indicator.consensus >= 6 ? 'high' : 'medium'}`}>{indicator.consensus}+ SOURCE MATCH</span><span className="incident-time">IP REPUTATION</span></span>
                  <strong>{indicator.ip}</strong>
                  <span className="incident-route"><span>{location ? `${location.city ? `${location.city}, ` : ''}${location.country}` : 'Approximate location unavailable'}</span></span>
                  {selectedIp === indicator.ip && <span className="incident-detail"><span>{indicator.consensus}+ independent public blocklists</span><span>{location?.organization ? `Network: ${location.organization}. ` : ''}IP geolocation indicates hosting location, not an attacker or event origin.</span></span>}
                </span>
              </button>
            )
          }) : <div className="empty-activity">{feedLoading ? 'Loading the public threat feed…' : feedError && !feed ? 'Threat indicators are unavailable until the feed can be loaded.' : searchQuery ? 'No indicators match your search.' : 'No indicators in this confidence tier.'}</div>}
        </div>
        <div className="indicator-list-footer">{filteredIndicators.length > 50 ? `Showing 50 of ${formatNumber(filteredIndicators.length)} matching indicators.` : `${formatNumber(filteredIndicators.length)} matching indicators.`}</div>
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
