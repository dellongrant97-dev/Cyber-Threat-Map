import { useMemo, useState } from 'react'

const incidents = [
  { id: 'INC-28491', title: 'Credential stuffing', origin: 'Moscow, RU', target: 'Frankfurt, DE', time: 'Just now', severity: 'critical', type: 'Identity', initials: 'RU', color: 'red' },
  { id: 'INC-28490', title: 'C2 beacon detected', origin: 'Shenzhen, CN', target: 'Singapore, SG', time: '2 min ago', severity: 'high', type: 'Malware', initials: 'CN', color: 'orange' },
  { id: 'INC-28489', title: 'DDoS mitigation', origin: 'São Paulo, BR', target: 'Ashburn, US', time: '5 min ago', severity: 'medium', type: 'Network', initials: 'BR', color: 'yellow' },
  { id: 'INC-28488', title: 'Suspicious login', origin: 'Lagos, NG', target: 'London, UK', time: '8 min ago', severity: 'high', type: 'Identity', initials: 'NG', color: 'orange' },
  { id: 'INC-28487', title: 'Phishing campaign', origin: 'Jakarta, ID', target: 'Tokyo, JP', time: '12 min ago', severity: 'low', type: 'Email', initials: 'ID', color: 'green' },
]

const threatPoints = [
  { x: 214, y: 169, severity: 'high', label: 'North America' },
  { x: 309, y: 333, severity: 'medium', label: 'South America' },
  { x: 508, y: 153, severity: 'critical', label: 'Europe' },
  { x: 604, y: 188, severity: 'high', label: 'Middle East' },
  { x: 726, y: 190, severity: 'critical', label: 'East Asia' },
  { x: 774, y: 297, severity: 'medium', label: 'Southeast Asia' },
  { x: 536, y: 353, severity: 'low', label: 'Southern Africa' },
]

const landShapes = [
  'M75 91l28-17 45 4 24 16 30 3 19 19-7 19-25 7-12 18-17 4-3 22-17 12-11 34-17 13-18-7-7-17-18-13-2-29-18-20-14-27-1-23 16-18 8-22z',
  'M208 229l18 4 10 20 20 9 10 22-7 25-14 11-7 33-17 31-12 5-7-20-13-22 2-25-11-25 6-24-5-23 15-21z',
  'M420 101l19-18 36-8 23 10 8 18-14 12-24-3-15 13-23-5-10-19z',
  'M456 141l22-10 30 5 15 15 14 5 9 25 13 12-7 19-16 11-5 28-16 17-9 28-17 11-8-20-13-12 1-25-13-14-2-23-13-14 6-19-10-18z',
  'M529 89l31-15 48 2 24 11 31-3 21 12 35-4 36 12 22-2 37 20 35 6 31 17 19 25-9 15-26-6-14 14-27-8-11 16-22-5-17 20-21-4-14 22-20-7-15-19-24 7-12-14-25 4-7-18-28 3-18-15-33-2-10-20-27 3-12-16-29-2-20-18-26 1-15-15 12-21z',
  'M639 204l14 9 7 23 17 14 1 22 15 17-4 35-11 19-15-6-8-25-14-18-5-27-16-20 3-22 16-21z',
  'M856 310l29-5 15 10 4 17-17 14-22-4-13-14 4-18z',
  'M364 329l17-7 20 7 7 15-14 9-22-4-8-11z',
]

const tabs = [
  { label: 'Overview', icon: 'grid' },
  { label: 'Threat map', icon: 'radar' },
  { label: 'Incidents', icon: 'alert', count: '18' },
  { label: 'Intelligence', icon: 'pulse' },
]

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="m12 12 7-7M12 3v9h9" /></>,
    alert: <><path d="M10.3 3.9 2.5 17.4A1.8 1.8 0 0 0 4.1 20h15.8a1.8 1.8 0 0 0 1.6-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 3h.01" /></>,
    pulse: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.8-.6a8 8 0 0 1-1.7 1l-.3 1.9h-2.8l-.3-1.9a8 8 0 0 1-1.7-1l-1.8.6-1.4-2.4 1.5-1.2a7 7 0 0 1 0-2l-1.5-1.2 1.4-2.4 1.8.6a8 8 0 0 1 1.7-1l.3-1.9h2.8l.3 1.9a8 8 0 0 1 1.7 1l1.8-.6 1.4 2.4-1.5 1.2a7 7 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function WorldMap({ filter }) {
  const visiblePoints = threatPoints.filter((point) => filter === 'All activity' || point.severity === filter.toLowerCase())

  return (
    <svg className="world-map" viewBox="0 0 1000 500" role="img" aria-labelledby="map-title map-desc" preserveAspectRatio="xMidYMid meet">
      <title id="map-title">Global cyber threat activity map</title>
      <desc id="map-desc">A 2D world map showing attack routes and threat activity hotspots across seven regions.</desc>
      <defs>
        <pattern id="map-dots" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#273439" />
        </pattern>
        <pattern id="land-dots" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1.1" cy="1.1" r="1.15" fill="#405257" />
        </pattern>
        <filter id="route-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="1000" height="500" fill="url(#map-dots)" opacity=".42" />
      <g className="graticules">
        <path d="M0 125H1000M0 250H1000M0 375H1000" />
        <path d="M250 0v500M500 0v500M750 0v500" />
        <ellipse cx="500" cy="250" rx="470" ry="210" />
      </g>
      <g className="continents">
        {landShapes.map((shape, index) => <path d={shape} key={index} />)}
      </g>
      <g className="routes" filter="url(#route-glow)">
        <path className="route route-red" d="M505 150 Q402 54 214 169" />
        <path className="route route-cyan" d="M727 188 Q652 81 508 151" />
        <path className="route route-orange" d="M773 297 Q716 116 508 151" />
        <path className="route route-green" d="M310 333 Q350 202 508 151" />
        <path className="route route-blue" d="M604 188 Q690 260 773 297" />
        <path className="route route-red route-dash" d="M214 169 Q417 252 604 188" />
      </g>
      <g className="map-points">
        {visiblePoints.map((point) => (
          <g className={`map-point point-${point.severity}`} key={point.label} transform={`translate(${point.x} ${point.y})`}>
            <circle className="point-pulse" r="15" />
            <circle className="point-halo" r="7" />
            <circle className="point-core" r="3.5" />
            <title>{point.label}: {point.severity} activity</title>
          </g>
        ))}
      </g>
      <g className="map-coordinates">
        <text x="22" y="28">LIVE GLOBAL TELEMETRY</text>
        <text x="22" y="47">38° 54′ N  ·  77° 02′ W</text>
        <text x="978" y="476" textAnchor="end">PROJECTION · EQUIRECTANGULAR</text>
      </g>
    </svg>
  )
}

function severityLabel(severity) {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

function App() {
  const [activeTab, setActiveTab] = useState('Threat map')
  const [filter, setFilter] = useState('All activity')
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [timeRange, setTimeRange] = useState('24H')
  const [searchOpen, setSearchOpen] = useState(false)

  const filteredIncidents = useMemo(
    () => incidents.filter((incident) => filter === 'All activity' || incident.severity === filter.toLowerCase()),
    [filter],
  )

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Sentinel home" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark"><span /></span>
          <span className="brand-name">sentinel<span className="brand-period">.</span><small>THREAT INTELLIGENCE</small></span>
        </a>

        <div className="workspace-switch">
          <span className="workspace-avatar">N</span>
          <span className="workspace-copy"><strong>Northstar Security</strong><small>Enterprise workspace</small></span>
          <span className="workspace-caret">⌄</span>
        </div>

        <div className="nav-label">MONITOR</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {tabs.map((tab) => (
            <button className={`nav-item ${activeTab === tab.label ? 'active' : ''}`} key={tab.label} onClick={() => setActiveTab(tab.label)} aria-current={activeTab === tab.label ? 'page' : undefined}>
              <Icon name={tab.icon} /><span>{tab.label}</span>{tab.count && <span className="nav-count">{tab.count}</span>}
            </button>
          ))}
        </nav>

        <div className="nav-label intel-label">INTELLIGENCE</div>
        <button className="nav-item subdued" onClick={() => setActiveTab('Asset inventory')}><span className="nav-mini-icon">◈</span><span>Asset inventory</span></button>
        <button className="nav-item subdued" onClick={() => setActiveTab('Reports')}><span className="nav-mini-icon">▤</span><span>Reports</span></button>

        <div className="sidebar-spacer" />
        <div className="plan-card">
          <div className="plan-card-top"><span className="plan-icon">✳</span><span className="plan-status">PRO</span></div>
          <strong>Threat coverage</strong>
          <p>Your global sensors are protecting <b>1,284 assets.</b></p>
          <div className="coverage-track"><span /></div>
          <div className="coverage-caption"><span>Sensor network</span><b>98.4%</b></div>
        </div>
        <button className="nav-item settings-link" onClick={() => setActiveTab('Settings')}><Icon name="settings" /><span>Settings</span></button>
        <div className="profile">
          <span className="profile-avatar">JD</span>
          <span className="profile-copy"><strong>Jordan Davis</strong><small>Security analyst</small></span>
          <span className="profile-menu">···</span>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Monitor</span><Icon name="chevron" size={14} /><strong>{activeTab}</strong></div>
          <div className="topbar-actions">
            <span className="system-health"><i /> All systems operational</span>
            <span className="topbar-divider" />
            <button className="icon-button" aria-label="Search" onClick={() => setSearchOpen(!searchOpen)}><Icon name="search" /></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" /><i /></button>
            <button className="help-button">Help center <Icon name="arrow" size={13} /></button>
          </div>
          {searchOpen && <div className="search-popover"><Icon name="search" size={16} /><input autoFocus aria-label="Search incidents and locations" placeholder="Search incidents, locations..." /><kbd>ESC</kbd><button onClick={() => setSearchOpen(false)} aria-label="Close search">×</button></div>}
        </header>

        <div className="dashboard-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="live-dot" /> GLOBAL SECURITY OPERATIONS</div>
              <h1>Threat overview<span>.</span></h1>
              <p className="page-subtitle">Your global security posture, at a glance.</p>
            </div>
            <button className="range-button" onClick={() => setTimeRange(timeRange === '24H' ? '7D' : timeRange === '7D' ? '30D' : '24H')}>
              <Icon name="clock" size={15} /> Last {timeRange === '24H' ? '24 hours' : timeRange === '7D' ? '7 days' : '30 days'} <span className="range-caret">⌄</span>
            </button>
          </div>

          <section className="stats-grid" aria-label="Security overview statistics">
            <article className="stat-card">
              <div className="stat-label">ATTACKS BLOCKED <span className="stat-icon green-icon">↗</span></div>
              <div className="stat-value">2,847</div>
              <div className="stat-foot"><span className="change-positive">↑ 12.8%</span><span>vs. previous period</span></div>
              <div className="sparkline spark-green"><svg viewBox="0 0 92 32" aria-hidden="true"><path d="M2 27 13 22 24 24 35 13 46 17 57 8 68 14 79 5 90 8" /></svg></div>
            </article>
            <article className="stat-card">
              <div className="stat-label">ACTIVE THREATS <span className="stat-icon red-icon">⌁</span></div>
              <div className="stat-value">18<span className="value-unit"> events</span></div>
              <div className="stat-foot"><span className="change-alert">6 critical</span><span>requiring attention</span></div>
              <div className="sparkline spark-red"><svg viewBox="0 0 92 32" aria-hidden="true"><path d="M2 25 13 21 24 24 35 13 46 17 57 11 68 16 79 4 90 9" /></svg></div>
            </article>
            <article className="stat-card">
              <div className="stat-label">PROTECTED ASSETS <span className="stat-icon cyan-icon">⌘</span></div>
              <div className="stat-value">1,284</div>
              <div className="stat-foot"><span className="change-positive">↑ 24</span><span>added this month</span></div>
              <div className="sparkline spark-cyan"><svg viewBox="0 0 92 32" aria-hidden="true"><path d="M2 26 13 20 24 24 35 18 46 20 57 11 68 14 79 7 90 3" /></svg></div>
            </article>
            <article className="stat-card">
              <div className="stat-label">NETWORK UPTIME <span className="stat-icon green-icon">⌁</span></div>
              <div className="stat-value">99.98<span className="value-unit">%</span></div>
              <div className="stat-foot"><span className="change-positive">Optimal</span><span>last 30 days</span></div>
              <div className="uptime-bars" aria-label="Uptime consistently above 99 percent">{Array.from({ length: 17 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 17) % 17)}px` }} />)}</div>
            </article>
          </section>

          <section className="map-panel">
            <div className="panel-heading map-heading">
              <div><h2>Global threat activity</h2><p>Real-time attack telemetry across your network</p></div>
              <div className="map-heading-actions">
                <div className="live-badge"><span className="live-dot" /> LIVE</div>
                <button className="map-menu" aria-label="Map options">···</button>
              </div>
            </div>
            <div className="map-filter-row" role="group" aria-label="Filter threat map by severity">
              {['All activity', 'Critical', 'High', 'Medium'].map((option) => <button key={option} className={`filter-chip ${filter === option ? 'selected' : ''}`} onClick={() => setFilter(option)}>{option === 'All activity' ? <span className="filter-total">18</span> : <i className={`severity-dot ${option.toLowerCase()}`} />}{option}</button>)}
              <span className="map-filter-spacer" />
              <span className="map-updated"><span className="refresh-mark">↻</span> Updated just now</span>
            </div>
            <div className="map-stage"><WorldMap filter={filter} /></div>
            <div className="map-footer">
              <div className="legend"><span className="legend-title">THREAT LEVEL</span><span><i className="severity-dot critical" /> Critical</span><span><i className="severity-dot high" /> High</span><span><i className="severity-dot medium" /> Medium</span><span><i className="severity-dot low" /> Low</span></div>
              <div className="map-scale"><span>LOW ACTIVITY</span><i /><i /><i /><i /><i /><span>HIGH</span></div>
            </div>
          </section>

          <section className="bottom-grid">
            <article className="bottom-card trend-card">
              <div className="panel-heading compact-heading"><div><h2>Attack volume</h2><p>Blocked attempts over time</p></div><button className="subtle-select">Last 24 hours <span>⌄</span></button></div>
              <div className="chart-wrap">
                <div className="chart-ylabels"><span>400</span><span>300</span><span>200</span><span>100</span><span>0</span></div>
                <svg className="volume-chart" viewBox="0 0 660 136" preserveAspectRatio="none" role="img" aria-label="Attack volume trending upward throughout the day">
                  <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a8ff74" stopOpacity=".2" /><stop offset="100%" stopColor="#a8ff74" stopOpacity="0" /></linearGradient></defs>
                  <path className="chart-gridline" d="M0 8H660M0 38H660M0 68H660M0 98H660M0 128H660" />
                  <path className="chart-area" d="M0 100 C25 96 31 84 54 89 S94 101 112 82 S148 76 165 80 S204 61 220 70 S252 57 275 62 S305 45 330 57 S360 50 385 54 S416 38 440 43 S475 30 495 42 S526 27 549 34 S580 18 606 29 S639 10 660 13 V136 H0Z" />
                  <path className="chart-line" d="M0 100 C25 96 31 84 54 89 S94 101 112 82 S148 76 165 80 S204 61 220 70 S252 57 275 62 S305 45 330 57 S360 50 385 54 S416 38 440 43 S475 30 495 42 S526 27 549 34 S580 18 606 29 S639 10 660 13" />
                  <circle cx="660" cy="13" r="4" />
                </svg>
              </div>
              <div className="chart-xlabels"><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>Now</span></div>
            </article>
            <article className="bottom-card response-card">
              <div className="panel-heading compact-heading"><div><h2>Response performance</h2><p>Mean time to detect &amp; resolve</p></div><span className="response-health">ON TARGET</span></div>
              <div className="response-metrics">
                <div><span className="response-metric-label">MEAN TIME TO DETECT</span><strong>2<span>m</span> 14<span>s</span></strong><small><b>↓ 18%</b> vs. last month</small></div>
                <span className="response-divider" />
                <div><span className="response-metric-label">MEAN TIME TO RESOLVE</span><strong>18<span>m</span> 42<span>s</span></strong><small><b>↓ 24%</b> vs. last month</small></div>
              </div>
              <div className="response-note"><span className="response-check">✓</span> Your team is responding faster than 92% of peers</div>
            </article>
          </section>
        </div>
      </section>

      <aside className="activity-sidebar">
        <div className="activity-header">
          <div className="activity-title-row"><h2>Live activity</h2><span className="activity-count">18</span><button className="activity-more" aria-label="More activity options">···</button></div>
          <p><span className="live-dot" /> Streaming global events</p>
        </div>
        <div className="activity-summary"><span><i className="severity-dot critical" /><b>6</b> Critical</span><span><i className="severity-dot high" /><b>8</b> High</span><span><i className="severity-dot medium" /><b>4</b> Medium</span></div>
        <div className="activity-list">
          {filteredIncidents.length ? filteredIncidents.map((incident, index) => (
            <button className={`incident ${selectedIncident === incident.id ? 'incident-selected' : ''}`} key={incident.id} onClick={() => setSelectedIncident(selectedIncident === incident.id ? null : incident.id)} aria-expanded={selectedIncident === incident.id}>
              <span className={`incident-indicator ${incident.color}`}><span /></span>
              <span className="incident-content">
                <span className="incident-meta"><span className={`severity-text ${incident.severity}`}>{severityLabel(incident.severity)}</span><span className="incident-time">{incident.time}</span></span>
                <strong>{incident.title}</strong>
                <span className="incident-route"><span>{incident.origin}</span><b>→</b><span>{incident.target}</span></span>
                {selectedIncident === incident.id && <span className="incident-detail"><span>{incident.id}</span><span>{incident.type} threat · automatically contained</span></span>}
              </span>
            </button>
          )) : <div className="empty-activity">No {filter.toLowerCase()} events right now.</div>}
        </div>
        <button className="all-incidents" onClick={() => { setActiveTab('Incidents'); setFilter('All activity') }}>View all incidents <Icon name="arrow" size={14} /></button>
        <div className="activity-divider" />
        <div className="sensor-heading"><div><h3>Sensor network</h3><p>Regional coverage</p></div><button aria-label="Sensor network options">···</button></div>
        <div className="sensor-list">
          {[['North America', '426 sensors', '99.9%', 'north'], ['Europe', '318 sensors', '99.8%', 'europe'], ['Asia Pacific', '284 sensors', '98.7%', 'asia'], ['South America', '156 sensors', '99.2%', 'south']].map(([region, sensors, health, key]) => <div className="sensor-row" key={region}><span className={`sensor-pip ${key}`} /><span className="sensor-region"><strong>{region}</strong><small>{sensors}</small></span><span className="sensor-health">{health}</span></div>)}
        </div>
        <div className="sensor-foot"><span><i /> All regions connected</span><button aria-label="Refresh sensor network">↻</button></div>
        <div className="activity-footer"><Icon name="clock" size={13} /> Last sync 4 seconds ago</div>
      </aside>
    </main>
  )
}

export default App
