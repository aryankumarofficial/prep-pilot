# syntax=docker/dockerfile:1

FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS api
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
ARG PIP_DEFAULT_TIMEOUT=120
ARG PIP_RETRIES=10
ARG PIP_RESUME_RETRIES=10
WORKDIR /app/backend
# The base image can ship an older pip without interrupted-download recovery.
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    python -m pip install --disable-pip-version-check "pip==26.2.2"
COPY backend/requirements.lock ./
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    python -m pip install --disable-pip-version-check -r requirements.lock
COPY backend/ ./
COPY --from=web /web/dist /app/frontend/dist
RUN useradd --create-home --uid 10001 preppilot && mkdir -p /app/backend/.data/uploads && chown -R preppilot:preppilot /app
USER preppilot
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
