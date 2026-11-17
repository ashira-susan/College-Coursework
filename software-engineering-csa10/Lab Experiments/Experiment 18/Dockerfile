# Experiment 18 - multi-stage image: tests run INSIDE the build
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- test stage: build fails if any test fails ----
FROM base AS test
RUN pip install --no-cache-dir pytest
COPY app/ app/
COPY tests/ tests/
RUN python -m pytest tests -q

# ---- final (runtime) stage ----
FROM base AS final
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
COPY app/ .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
