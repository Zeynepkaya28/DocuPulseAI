.PHONY: dev supabase neo4j web api worker-tick gen test lint showcase stop

PY ?= apps/api/.venv/bin/python
ifeq ($(OS),Windows_NT)
PY = apps/api/.venv/Scripts/python
endif

## Full local stack: Supabase + Neo4j + web + api
dev: supabase neo4j
	npx concurrently -n web,api -c blue,green "npm run dev -w apps/web" "cd apps/api && $(abspath $(PY)) -m uvicorn app.main:app --reload --port 8000"

supabase:
	npx supabase start

neo4j:
	docker compose up -d neo4j

## Locally there is no pg_cron → Vercel call; drain the queues by hand.
worker-tick:
	node scripts/worker-tick.mjs

gen:
	npm run gen -w packages/contracts

test:
	cd apps/api && $(abspath $(PY)) -m pytest -q
	npm run typecheck

lint:
	cd apps/api && $(abspath $(PY)) -m ruff check .
	npm run lint

showcase:
	docker compose --profile showcase up -d

stop:
	npx supabase stop
	docker compose down
