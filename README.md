# ScribeCount Web Traffic

Monorepo for the ScribeCount web traffic analytics product: an **Angular** dashboard and a **.NET 10** Web API backed by **MySQL**, plus an optional **background worker** for scheduled or queue-driven work.

## Repository layout

| Path | Description |
|------|-------------|
| `frontend/` | Angular app (`scribecount-web-traffic`) — analytics UI |
| `backend/SCWebTraffic.API` | ASP.NET Core HTTP API (`/api/...`) |
| `backend/SCWebTraffic.Worker` | .NET worker service (run separately if you need those jobs in production) |
| `backend/SCWebTraffic.*` | Application, domain, and infrastructure layers |
| `backend/Database/` | SQL scripts and migration-related assets |

## Prerequisites

- **Node.js** (see `frontend/package.json` / `packageManager`) and npm  
- **.NET SDK 10** (matches `TargetFramework` in the API `.csproj`)  
- **MySQL 8** (or compatible) for the API and worker

## Configuration

The API reads `backend/SCWebTraffic.API/appsettings.json` by default. Override with environment variables (double underscore maps to nested JSON):

| Variable | Purpose |
|----------|---------|
| `ConnectionStrings__DefaultConnection` | MySQL connection string (Pomelo/MySQL format) |
| `Jwt__Secret` | Signing key (use a long random value in production) |
| `Jwt__Issuer` | JWT issuer (default in appsettings: `SCWebTraffic`) |
| `Jwt__Audience` | JWT audience (default: `SCWebTraffic.Client`) |

Example connection string:

`Server=localhost;Port=3306;Database=sc_web_traffic;User=root;Password=yourpassword;`

On first run, the API uses `ISchemaInitializer` to prepare the database schema.

## Local development

From the repository root:

```bash
npm run start:backend
```

runs the API (`dotnet run` in `backend/`). In another terminal:

```bash
npm run start:frontend
```

starts the Angular dev server (see `frontend/README.md` for the default URL).

To run the worker locally:

```bash
cd backend
npm run start:worker
```

## Docker (single image: API + static SPA)

The root `Dockerfile` builds the Angular app in production mode, publishes `SCWebTraffic.API`, copies the compiled SPA into `wwwroot`, and runs one process: the API, which serves both `/api/...` and the dashboard static files.

```bash
docker build -t scwebtraffic .
docker run --rm -p 8080:8080 \
  -e ConnectionStrings__DefaultConnection="Server=host.docker.internal;Port=3306;Database=sc_web_traffic;User=root;Password=;" \
  -e Jwt__Secret="your-production-secret-at-least-32-characters-long" \
  scwebtraffic
```

On Windows **PowerShell**, put the `-e` arguments on one line or use `` ` `` for line continuation instead of `\`.

Then open `http://localhost:8080`. If MySQL runs on your machine, `host.docker.internal` works on Docker Desktop (Windows/macOS).

The image also contains the published worker under `/app/worker` (not started by default).

## Deploying on Railway

1. Create a **Railway** project and connect this repository (deploy from the **repo root** so the root `Dockerfile` is used).
2. Provision **MySQL** (Railway plugin or external) and note host, port, database name, user, and password.
3. Open your **web** service → **Variables** and set the values below (do **not** commit passwords into `appsettings.json`; keep them only in Railway).

### Environment variables to set on Railway

| Variable | Required | Notes |
|----------|----------|--------|
| `ConnectionStrings__DefaultConnection` | **Yes** | Single-line Pomelo/MySQL connection string (see template below). |
| `Jwt__Secret` | **Yes** (production) | Long random string (32+ characters). Used to sign auth tokens. |
| `ASPNETCORE_ENVIRONMENT` | Recommended | Set to `Production` so Swagger and other dev-only behavior stay off. |
| `Jwt__Issuer` | No | Defaults to `SCWebTraffic` from `appsettings.json` if omitted. |
| `Jwt__Audience` | No | Defaults to `SCWebTraffic.Client` if omitted. |
| `PORT` | No | **Injected by Railway** — do not set manually; the API reads it and listens on that port. |

**Connection string template** (replace placeholders; escape special characters in the password if needed):

`Server=YOUR_HOST;Port=YOUR_PORT;Database=YOUR_DATABASE;User=YOUR_USER;Password=YOUR_PASSWORD;SslMode=Required;`

If TLS causes connection errors with your provider, try `SslMode=Preferred` or `SslMode=None` only for debugging.

**Worker service:** Add a second Railway service using the **same Docker image**, start command `dotnet /app/worker/SCWebTraffic.Worker.dll`, and give it at least the same `ConnectionStrings__DefaultConnection` (and the same `Jwt__*` values if the worker validates or issues tokens).

### Linking Railway MySQL variables

If Railway created variables like `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`, you can either reference them in `ConnectionStrings__DefaultConnection` using Railway’s variable interpolation, or paste one resolved connection string after copying values from the MySQL service.

4. Deploy. Railway injects **`PORT`** automatically; the API binds to it and uses forwarded headers (`X-Forwarded-For`, `X-Forwarded-Proto`) behind Railway’s proxy.

## Troubleshooting

- **Migrations / “table already exists”:** If a migration failed partway, the database can be left inconsistent. Use your backup strategy or, in development only, the scripts under `backend/Database/` as documented there to reset and re-apply schema.
- **MySQL index errors:** Older migrations used composite indexes that could exceed MySQL’s key length with long `VARCHAR` columns; the project index definitions were adjusted accordingly—ensure you are on current code before re-running migrations.

## License

Use and license terms are defined by the project owner; add a `LICENSE` file if you intend to open-source the repo.
