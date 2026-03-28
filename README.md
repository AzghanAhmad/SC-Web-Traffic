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
2. Add a **MySQL** (or compatible) plugin and create a database user/password.
3. Set variables on the web service, for example:
   - `ConnectionStrings__DefaultConnection` — use your Railway MySQL host, database name, user, and password (same format as local).
   - `Jwt__Secret` — strong random string.
4. Railway injects **`PORT`**; the API binds to it automatically. Reverse-proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`) are enabled so HTTPS and client IP behave correctly behind Railway’s proxy.

**Worker:** The default container command is the API only. To run the worker on Railway, add a **second service** that uses the **same Docker image** and set the start command to:

`dotnet /app/worker/SCWebTraffic.Worker.dll`

Give that service the same `ConnectionStrings__DefaultConnection` (and any other config the worker needs) as the API.

## Troubleshooting

- **Migrations / “table already exists”:** If a migration failed partway, the database can be left inconsistent. Use your backup strategy or, in development only, the scripts under `backend/Database/` as documented there to reset and re-apply schema.
- **MySQL index errors:** Older migrations used composite indexes that could exceed MySQL’s key length with long `VARCHAR` columns; the project index definitions were adjusted accordingly—ensure you are on current code before re-running migrations.

## License

Use and license terms are defined by the project owner; add a `LICENSE` file if you intend to open-source the repo.
