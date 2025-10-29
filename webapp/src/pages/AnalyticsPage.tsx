import { useEffect, useMemo, useState } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
  type TooltipItem
} from 'chart.js'
import { Bar, Line, Scatter } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import { fetchInsightAnalytics } from '../api/analytics'
import type { AdvancedAnalytics, MetricSummary, RegressionPrediction } from '../types'
import {
  panelClass,
  panelHeaderClass,
  panelBodyClass,
  panelSectionClass,
  emptyStateClass,
  buttonBaseClass
} from '../styles/ui'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  TimeScale,
  Filler
)

const metricLabels: Record<string, string> = {
  flowRateLpm: 'Flow rate (L/min)',
  pressureBar: 'Pressure (bar)',
  levelPercent: 'Reservoir level (%)',
  temperatureCelsius: 'Temperature (°C)'
}

const formatRange = (start?: Date, end?: Date) => {
  if (!start || !end) return '—'
  const startText = start.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  const endText = end.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${startText} → ${endText}`
}

const numeric = (value?: number, digits = 2) =>
  value === undefined || Number.isNaN(value) ? '—' : Number(value).toFixed(digits)

const percentage = (value?: number, digits = 1) =>
  value === undefined || Number.isNaN(value) ? '—' : `${(value * 100).toFixed(digits)}%`

const relativeTime = (date?: Date) => {
  if (!date) return '—'
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const diffMinutes = Math.round((date.getTime() - Date.now()) / (60 * 1000))
  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute')
  }
  return formatter.format(Math.round(diffMinutes / 60), 'hour')
}

const hasSeries = (series: Array<{ data: unknown[] }>) =>
  series.some((dataset) => dataset.data.length > 1)

const buildMetricCards = (metrics: Record<string, MetricSummary>) =>
  Object.entries(metrics)
    .filter(([key]) => metricLabels[key])
    .map(([key, summary]) => ({
      key,
      title: metricLabels[key],
      summary
    }))

const AnalyticsPage = () => {
  const [analytics, setAnalytics] = useState<AdvancedAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAnalytics = async () => {
    setIsLoading(true)
    try {
      const result = await fetchInsightAnalytics()
      setAnalytics(result)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics'
      setError(message)
      setAnalytics(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  const metricCards = useMemo(() => {
    if (!analytics) return []
    return buildMetricCards(analytics.eda.metrics)
  }, [analytics])

  const timeseriesChart = useMemo(() => {
    if (!analytics || analytics.timeseries.length === 0) {
      return null
    }

    const buildDataset = (
      key: 'flowRateLpm' | 'pressureBar' | 'levelPercent' | 'temperatureCelsius',
      label: string,
      color: string
    ) => {
      const points = analytics.timeseries
        .filter((point) => point[key] !== undefined)
        .map((point) => ({ x: point.timestamp.getTime(), y: point[key] as number }))

      if (points.length < 2) {
        return null
      }

      return {
        label,
        data: points,
        parsing: false,
        borderColor: color,
        backgroundColor: `${color}33`,
        pointRadius: 0,
        pointHitRadius: 6,
        tension: 0.25,
        borderWidth: 2,
        fill: key === 'flowRateLpm' ? 'origin' : false
      }
    }

    const datasets = [
      buildDataset('flowRateLpm', 'Flow rate', 'rgba(56,189,248,1)'),
      buildDataset('pressureBar', 'Pressure', 'rgba(129,140,248,1)'),
      buildDataset('levelPercent', 'Reservoir level', 'rgba(34,197,94,1)'),
      buildDataset('temperatureCelsius', 'Temperature', 'rgba(249,115,22,1)')
    ].filter(Boolean) as Array<{ label: string; data: { x: number; y: number }[] }>

    if (!hasSeries(datasets)) {
      return null
    }

    return {
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'hour',
              displayFormats: {
                hour: 'HH:mm'
              }
            },
            ticks: {
              color: 'rgba(148, 163, 184, 0.85)'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.12)'
            }
          },
          y: {
            ticks: {
              color: 'rgba(148, 163, 184, 0.85)'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.1)'
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'rgba(226, 232, 240, 0.86)'
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      } as const
    }
  }, [analytics])

  const zoneChart = useMemo(() => {
    if (!analytics || analytics.eda.zoneAverages.length === 0) {
      return null
    }

    const labels = analytics.eda.zoneAverages.map((zone) => zone.zoneName)
    const dataset = analytics.eda.zoneAverages.map((zone) => zone.avgFlowLpm ?? 0)

    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Avg flow (L/min)',
            data: dataset,
            backgroundColor: 'rgba(59, 130, 246, 0.65)',
            borderColor: 'rgba(37, 99, 235, 0.85)',
            borderRadius: 6,
            barThickness: 16
          }
        ]
      },
      options: {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              color: 'rgba(148, 163, 184, 0.85)'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.12)'
            }
          },
          y: {
            ticks: {
              color: 'rgba(226, 232, 240, 0.86)'
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context: TooltipItem<'bar'>) => {
                const value =
                  typeof context.parsed.x === 'number' ? context.parsed.x : undefined
                return value === undefined ? '—' : `${value.toFixed(2)} L/min`
              }
            }
          }
        }
      }
    }
  }, [analytics])

  const regressionScatter = useMemo(() => {
    if (!analytics?.model || analytics.model.predictions.length < 4) {
      return null
    }

    const points = analytics.model.predictions.map((prediction) => ({
      x: prediction.actual,
      y: prediction.predicted
    }))

    const actualValues = analytics.model.predictions.map((item) => item.actual)
    const minActual = Math.min(...actualValues)
    const maxActual = Math.max(...actualValues)

    return {
      data: {
        datasets: [
          {
            label: 'Predicted vs actual',
            data: points,
            borderColor: 'rgba(52, 211, 153, 0.9)',
            backgroundColor: 'rgba(52, 211, 153, 0.25)',
            pointRadius: 4
          },
          {
            label: 'Ideal fit',
            data: [
              { x: minActual, y: minActual },
              { x: maxActual, y: maxActual }
            ],
            borderColor: 'rgba(148, 163, 184, 0.6)',
            pointRadius: 0,
            borderDash: [6, 4],
            showLine: true,
            backgroundColor: 'transparent'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Observed flow (L/min)',
              color: 'rgba(226, 232, 240, 0.86)'
            },
            ticks: {
              color: 'rgba(148, 163, 184, 0.85)'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.12)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Predicted flow (L/min)',
              color: 'rgba(226, 232, 240, 0.86)'
            },
            ticks: {
              color: 'rgba(148, 163, 184, 0.85)'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.12)'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: 'rgba(226, 232, 240, 0.86)'
            }
          }
        }
      }
    }
  }, [analytics])

  const modelOutliers = useMemo(() => {
    if (!analytics?.model) return []
    return analytics.model.outliers.slice(0, 5)
  }, [analytics])

  const modelFeatureImportance = useMemo(() => {
    if (!analytics?.model) return []
    return analytics.model.featureImportance
  }, [analytics])

  const renderResidual = (entry: RegressionPrediction) =>
    `${numeric(entry.residual, 2)} L/min`

  const renderMetricSummary = (summary: MetricSummary) => (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">
      <div className="flex items-center justify-between">
        <dt>Mean</dt>
        <dd className="text-slate-200">{numeric(summary.mean)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt>Median</dt>
        <dd className="text-slate-200">{numeric(summary.median)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt>Std dev</dt>
        <dd className="text-slate-200">{numeric(summary.stdDev)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt>Range</dt>
        <dd className="text-slate-200">
          {numeric(summary.min)} → {numeric(summary.max)}
        </dd>
      </div>
      <div className="flex items-center justify-between">
        <dt>P25</dt>
        <dd className="text-slate-200">{numeric(summary.p25)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt>P75</dt>
        <dd className="text-slate-200">{numeric(summary.p75)}</dd>
      </div>
    </dl>
  )

  const correlations = analytics?.eda.correlations ?? []

  const showEmptyState = !isLoading && !analytics && !error

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className={panelClass}>
        <div className={panelHeaderClass}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Exploratory analytics</h1>
              <p className="text-sm text-slate-400">
                EDA, regression modelling, and residual monitoring across simulated telemetry.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-1 text-slate-300">
                {formatRange(analytics?.windowStart, analytics?.windowEnd)}
              </span>
              <span className="rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-1 text-slate-300">
                {analytics ? `${analytics.sampleCount} samples` : '—'}
              </span>
              <button type="button" className={buttonBaseClass} onClick={loadAnalytics}>
                Refresh
              </button>
            </div>
          </div>
        </div>
        <div className={`${panelBodyClass} gap-6`}>
          {isLoading ? (
            <div className={emptyStateClass}>Loading exploratory analytics…</div>
          ) : error ? (
            <div className={`${emptyStateClass} text-red-300`}>
              <p>{error}</p>
              <button type="button" className={buttonBaseClass} onClick={loadAnalytics}>
                Retry
              </button>
            </div>
          ) : showEmptyState ? (
            <div className={emptyStateClass}>No telemetry available for analysis yet.</div>
          ) : analytics ? (
            <div className="flex flex-col gap-6">
              <section className={panelSectionClass}>
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-100">Metric distribution</h2>
                  <span className="text-xs text-slate-400">
                    Summary statistics computed from recent measurements.
                  </span>
                </header>
                {metricCards.length === 0 ? (
                  <p className="text-sm text-slate-400">Waiting on recent readings.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {metricCards.map((card) => (
                      <article
                        key={card.key}
                        className="flex flex-col gap-3 rounded-lg border border-slate-700/40 bg-slate-900/60 p-4"
                      >
                        <header>
                          <h3 className="text-sm font-semibold text-slate-100">{card.title}</h3>
                          <p className="text-xs text-slate-400">
                            {card.summary.sampleSize} samples
                          </p>
                        </header>
                        {renderMetricSummary(card.summary)}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className={panelSectionClass}>
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-100">Time-series view</h2>
                  <span className="text-xs text-slate-400">
                    10-minute averages for flow, pressure, level, and temperature.
                  </span>
                </header>
                {timeseriesChart ? (
                  <div className="relative h-72 w-full">
                    <Line data={timeseriesChart.data} options={timeseriesChart.options} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Not enough points for a trend line yet.</p>
                )}
              </section>

              <section className={panelSectionClass}>
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-100">Zone performance</h2>
                  <span className="text-xs text-slate-400">
                    Average flow rate by zone with current sampling density.
                  </span>
                </header>
                {zoneChart ? (
                  <div className="relative h-72 w-full">
                    <Bar data={zoneChart.data} options={zoneChart.options} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No zone telemetry available.</p>
                )}
              </section>

              <section className={panelSectionClass}>
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-100">Correlation matrix</h2>
                  <span className="text-xs text-slate-400">
                    Pearson correlation between flow and contributing signals.
                  </span>
                </header>
                {correlations.length === 0 ? (
                  <p className="text-sm text-slate-400">No paired measurements yet.</p>
                ) : (
                  <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {correlations.map((entry) => (
                      <li
                        key={`${entry.from}-${entry.to}`}
                        className="flex flex-col gap-1 rounded-lg border border-slate-700/40 bg-slate-900/60 p-4"
                      >
                        <div className="flex items-baseline justify-between gap-2 text-sm text-slate-200">
                          <span className="font-medium">
                            {metricLabels[entry.from] ?? entry.from} ↔ {metricLabels[entry.to] ?? entry.to}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              Math.abs(entry.coefficient) > 0.7
                                ? 'text-emerald-300'
                                : Math.abs(entry.coefficient) > 0.4
                                ? 'text-sky-300'
                                : 'text-slate-300'
                            }`}
                          >
                            {numeric(entry.coefficient, 3)}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {entry.sampleSize} paired samples
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={panelSectionClass}>
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-100">Regression model</h2>
                  {analytics.model ? (
                    <span className="text-xs text-slate-400">
                      Updated {relativeTime(analytics.model.lastUpdated)} · {analytics.model.validationSamples}{' '}
                      validation samples
                    </span>
                  ) : null}
                </header>
                {!analytics.model ? (
                  <p className="text-sm text-slate-400">
                    Not enough high-quality data across the selected signals to fit a model yet.
                  </p>
                ) : (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="flex flex-col gap-4">
                      <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 p-4">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                          Evaluation metrics
                        </h3>
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-200">
                          <div className="flex flex-col">
                            <dt className="text-xs uppercase tracking-widest text-slate-500">MAE</dt>
                            <dd>{numeric(analytics.model.evaluation.mae)} L/min</dd>
                          </div>
                          <div className="flex flex-col">
                            <dt className="text-xs uppercase tracking-widest text-slate-500">RMSE</dt>
                            <dd>{numeric(analytics.model.evaluation.rmse)} L/min</dd>
                          </div>
                          <div className="flex flex-col">
                            <dt className="text-xs uppercase tracking-widest text-slate-500">R²</dt>
                            <dd>{numeric(analytics.model.evaluation.r2, 3)}</dd>
                          </div>
                          <div className="flex flex-col">
                            <dt className="text-xs uppercase tracking-widest text-slate-500">Samples</dt>
                            <dd>
                              {analytics.model.trainingSamples} train · {analytics.model.validationSamples} val
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {regressionScatter ? (
                        <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 p-4">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                            Prediction fit
                          </h3>
                          <div className="relative mt-3 h-64 w-full">
                            <Scatter
                              data={regressionScatter.data}
                              options={regressionScatter.options}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 p-4">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                          Feature weights
                        </h3>
                        {modelFeatureImportance.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-400">No signal variability detected.</p>
                        ) : (
                          <ul className="mt-3 flex flex-col gap-3">
                            {modelFeatureImportance.map((item) => (
                              <li key={item.feature} className="flex flex-col gap-1 text-sm">
                                <div className="flex items-center justify-between text-slate-200">
                                  <span>{item.feature}</span>
                                  <span className="text-xs text-slate-400">
                                    Weight {numeric(item.weight, 4)} · Influence {percentage(item.importance)}
                                  </span>
                                </div>
                                <span className="block h-2 rounded-full bg-slate-800">
                                  <span
                                    className="block h-full rounded-full bg-emerald-400/70"
                                    style={{ width: `${Math.max(item.importance * 100, 4)}%` }}
                                  />
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {modelOutliers.length > 0 ? (
                        <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 p-4">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                            Largest residuals
                          </h3>
                          <ul className="mt-3 flex flex-col gap-3 text-xs text-slate-300">
                            {modelOutliers.map((entry) => (
                              <li key={`${entry.sensorId}-${entry.timestamp.toISOString()}`}>
                                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-200">
                                  <span className="font-medium" title={entry.sensorName}>
                                    {entry.sensorName}
                                  </span>
                                  <span className="rounded-md bg-slate-800/70 px-2 py-0.5 text-xs text-sky-200">
                                    Residual {renderResidual(entry)}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                  <span>{entry.zone.name}</span>
                                  <span title={entry.timestamp.toLocaleString()}>{relativeTime(entry.timestamp)}</span>
                                  <span>
                                    Actual {numeric(entry.actual)} · Pred {numeric(entry.predicted)}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPage
