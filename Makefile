# Stepwell developer commands. Prerequisites: Python 3.11+, Node 22 + pnpm 10, (optional) Docker.
.PHONY: help install dev-api dev-web dev-mobile test lint typecheck build up down

help:            ## show this help
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  %-12s %s\n", $$1, $$2}'

install:         ## install backend (dev), model pipeline (dev) and JS workspaces
	python -m pip install -e "backend[dev]" -e "ml[dev]"
	pnpm install

dev-api:         ## run the API with reload on :8000
	cd backend && cancer-insights serve --reload

dev-web:         ## run the web app on :3000 (expects the API on :8000)
	pnpm --filter @stepwell/web dev

dev-mobile:      ## start Expo (press i / a / w)
	pnpm --filter @stepwell/mobile start

test:            ## all test suites
	cd backend && pytest
	cd ml && pytest tests
	pnpm --filter @stepwell/shared test

lint:            ## linters
	cd backend && ruff check app tests
	cd ml && ruff check stepwell_ml tests

typecheck:       ## TypeScript everywhere
	pnpm --filter @stepwell/shared exec tsc --noEmit -p .
	pnpm --filter @stepwell/web exec tsc --noEmit
	pnpm --filter @stepwell/mobile exec tsc --noEmit

build:           ## production web build
	pnpm --filter @stepwell/web build

up:              ## full stack with Docker Compose (needs .env)
	docker compose up -d --build

down:            ## stop the stack
	docker compose down
