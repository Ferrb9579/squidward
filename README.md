# Squidward

Squidward is an end-to-end water infrastructure operations console that combines live telemetry, automated leak detection, alerting, and workflow automation. The repository is a TypeScript monorepo with an Express API, a Vite + React control room UI, an IoT data simulator, and optional tooling for request logging and AI-assisted navigation.

## Monorepo layout

| Path | Description |
| --- | --- |
| `backend/` | TypeScript Express service that ingests readings, runs leak and contamination detection, exposes REST + SSE APIs, manages automations, and dispatches email notifications. |
| `webapp/` | React (Vite) single-page app that renders dashboards, alert center, automation workflow, AI assistant, and the manual alert simulator. |
| `request-logger/` | Optional utility service that prints every HTTP request it receives — convenient for validating outbound automation webhooks. |

## Feature highlights

- **Real-time telemetry** via Server-Sent Events (`/api/stream`) including sensor readings, leak alerts, and simulator cycle heartbeats.
- **Leak + contamination detection** with historical baselines for flow rate, pressure, reservoir level, pH, turbidity, and chlorine.
- **Automation engine** that executes outbound webhooks when sensor thresholds or leak flags are tripped, including per-rule cooldowns and stateful tracking.
- **Alerting pipelines** with acknowledgement + resolution, email notifications, and a dedicated alert simulator page for on-demand testing.
- **Gemini-powered assistant** (optional) that can deep-link operators to dashboard sections or pre-select sensors.
- **Interactive dashboards** featuring sensor maps, live feeds, analytics charts, automation management, and API key administration.

## Backend capabilities

- Express v5 API with typed routes for sensors, measurements, automations, alerts, usage analytics, and API key lifecycle.
- MongoDB persistence for sensors, measurements, leak alerts, and automations (see `backend/src/models`).
- IoT simulator (`backend/src/iot/simulator.ts`) that seeds sample sensors and continuously emits realistic readings.
- Leak detection service that analyses rolling windows and emits `created`, `updated`, and `resolved` events consumed by email + SSE integrations.
- Manual alert creation endpoint (`POST /api/alerts/simulate`) used by the UI to verify email delivery instantly.
- Automation runtime that evaluates rules on each reading and executes outbound HTTP calls with optional payload templating and custom headers.
- API key verification for ingestion endpoints so external simulators can submit readings securely.

## Frontend experience

- Vite + React 19 app with Tailwind-driven styling and Zustand state management.
- Dashboard surfaces overview metrics, zone summaries, latest measurements, live event ticker, and leak alerts.
- Sensor Automations workspace with rule list, creation/editing form, and AI assistant deep-link support.
- Alert Center with acknowledgement/resolution shortcuts and real-time updates from SSE stream.
- **Alert Simulator** page to trigger manual leak alerts and confirm email pipeline readiness.
- Embedded AI assistant (`Ask Squidward`) that talks to the Gemini backend to navigate and prefill workflows.
- Map-based sensor creation page powered by Leaflet and OpenStreetMap.

## Getting started

### Prerequisites

- Node.js 20.x (or newer) and npm.
- MongoDB 6.x or a compatible hosted instance.
- (Optional) SMTP credentials for alert emails and a Google AI Studio key for the assistant.

### Clone & install

```powershell
git clone https://github.com/Ferrb9579/squidward.git
cd squidward

# Install backend dependencies
cd backend
npm install

# Install webapp dependencies
cd ..\webapp
npm install
```

### Configure environment variables

Create `backend/.env` (never commit real secrets) and populate the variables you need:

```dotenv
MONGO_URI=mongodb://localhost:27017/squidward
PORT=4000
## License

Specify your preferred license here (e.g., MIT, Apache 2.0) before publishing the repository publicly.
| `/alerts/:alertId/resolve` | POST | Mark an alert as resolved. |
| `/alerts/simulate` | POST | Create a manual alert (used by the Alert Simulator UI). |
| `/stream` | GET (SSE) | Subscribe to live readings, simulator cycles, and alert events. |
| `/analytics/usage` | GET | Retrieve usage analytics aggregates. |
| `/api-keys` | GET/POST/DELETE | Manage ingestion API keys. |

The ingestion endpoint lives at `/sensor/:sensorId` (root of the backend) and requires an `x-api-key` header matching a provisioned key.

## Real-time + alerting workflow

1. The simulator (or your own ingestion client) sends readings to the backend.
2. `leakDetectionService` evaluates thresholds, writing new alerts and emitting SSE + email events.
3. Frontend listeners update immediately via the `/api/stream` connection.
4. Operators can acknowledge/resolve alerts, define automation webhooks, or trigger manual alerts from the “Alert tester” page.

## Email + AI assistant notes

- The alert simulator highlights whether an email dispatch was enqueued based on your SMTP configuration.
- If you enable the AI assistant, provide a valid Google AI Studio key with access to the configured `MODEL_ID`. The frontend exposes the “Ask Squidward” bubble once the backend confirms the integration is enabled.

## Troubleshooting

- Vite may warn about bundle size during production builds; consider code-splitting heavy pages if you plan to deploy at scale.
- Ensure MongoDB is running before launching the backend, otherwise the simulator will fail to persist readings.
- If you do not see emails, double-check SMTP credentials and the `ALERT_RECIPIENTS` list, and review backend logs for `Failed to dispatch alert email` messages.

