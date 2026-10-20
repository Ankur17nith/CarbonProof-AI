.PHONY: install generate migrate seed dev build test check audit

install:
	npm ci

generate:
	npm run prisma:generate

migrate:
	npm run prisma:migrate

seed:
	npm run prisma:seed

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

check:
	npm run check

audit:
	npm run audit
