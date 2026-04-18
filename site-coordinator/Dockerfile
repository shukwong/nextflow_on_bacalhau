FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src

RUN pip install --no-cache-dir .

ENV COORDINATOR_WORKDIR_ROOT=/var/lib/site-coordinator \
    COORDINATOR_HOST=0.0.0.0 \
    COORDINATOR_PORT=8080
RUN mkdir -p /var/lib/site-coordinator

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request, sys; \
    r = urllib.request.urlopen('http://127.0.0.1:8080/v1/healthz', timeout=2); \
    sys.exit(0 if r.status == 200 else 1)"

CMD ["site-coordinator"]
