.PHONY: shell serve serve-stop validate evaluate manifest check-eval infer-relationships build help

DC  := docker compose
SVC := roadmap

help:
	@echo "Targets:"
	@echo "  make build        Build the Docker image"
	@echo "  make shell        Drop into a shell with claude / codex available"
	@echo "  make serve        Serve the static site on http://localhost:8080 (nginx, detached)"
	@echo "  make serve-stop   Stop the preview server"
	@echo "  make validate     Validate every cert JSON against schema/"
	@echo "  make manifest     Regenerate data/manifest.json from data/certs/**"
	@echo "  make check-eval   Verify every cert has a fresh evaluation block"
	@echo "  make evaluate     Open Claude inside the container to run the 3-persona skill"
	@echo "  make infer-relationships  Propose prereq edges (use --dry-run by default)"

build:
	$(DC) build

shell: build
	$(DC) run --rm $(SVC) bash

serve:
	$(DC) up -d preview
	@echo ""
	@echo "Preview: http://localhost:8080"
	@echo "Stop with: make serve-stop"

serve-stop:
	$(DC) stop preview
	$(DC) rm -f preview

validate: build
	$(DC) run --rm $(SVC) bash -lc 'set -e; \
	  ajv validate \
	    --spec=draft2020 \
	    -c ajv-formats \
	    -s schema/certification.schema.json \
	    -d "data/certs/**/*.json" \
	    --all-errors --errors=text; \
	  echo "OK: all cert JSON files validate."'

manifest: build
	$(DC) run --rm $(SVC) python3 scripts/build_manifest.py

check-eval: build
	$(DC) run --rm $(SVC) python3 scripts/check_evaluations_fresh.py

infer-relationships: build
	$(DC) run --rm $(SVC) python3 scripts/infer_relationships.py --dry-run

evaluate: build
	$(DC) run --rm $(SVC) bash -lc '\
	  if ! command -v claude >/dev/null 2>&1; then \
	    echo "ERROR: claude CLI not on PATH inside container" >&2; exit 1; \
	  fi; \
	  echo "Inside the Claude REPL, run: /skill evaluate-roadmap-3-personas"; \
	  exec claude'
