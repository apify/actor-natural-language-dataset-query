.PHONY: docker-build
docker-build:
	docker build -t tiny-query-engine -f .actor/Dockerfile .

.PHONY: docker-run
docker-run:
	docker run -it --rm -e OPENAI_API_KEY -e ACTOR_INPUT -e APIFY_TOKEN tiny-query-engine

.PHONY: format
format:
	bun run biome format

.PHONY: format-fix
format-fix:
	bun run biome format --fix

.PHONY: lint
lint:
	bun run biome lint

.PHONY: lint-fix
lint-fix:
	bun run biome lint --fix

.PHONY: test
test:
	bun test
