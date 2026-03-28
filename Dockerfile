# syntax=docker/dockerfile:1

# --- Angular dashboard (production build) ---
FROM node:22-alpine AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- .NET API publish + static wwwroot ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src/backend
COPY backend/ ./
RUN dotnet publish SCWebTraffic.API/SCWebTraffic.API.csproj -c Release -o /app/publish \
 && dotnet publish SCWebTraffic.Worker/SCWebTraffic.Worker.csproj -c Release -o /app/worker-publish
COPY --from=frontend-build /src/frontend/dist/scribecount-web-traffic/browser/ /app/publish/wwwroot/

# --- Runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=backend-build /app/worker-publish ./worker
EXPOSE 8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENTRYPOINT ["dotnet", "SCWebTraffic.API.dll"]
