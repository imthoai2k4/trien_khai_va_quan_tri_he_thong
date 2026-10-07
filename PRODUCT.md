# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS (user-selected for this build). Note: existing plan document (`KE_HOACH_HE_THONG_DAT_VE_XEM_PHIM.md`) describes a Node.js + Express + MySQL + Docker Compose + Nginx architecture; the user has selected a simpler static build for current work.

## Users

Primary: creative/professional users working on a task or project workflow. The existing Vietnamese plan document (`KE_HOACH_HE_THONG_DAT_VE_XEM_PHIM.md`) defines end-users of a movie-ticket booking system (view movies, select showtimes, choose seats, book, simulated payment) and basic admin users (manage movies, rooms, seats, showtimes, view bookings/payment status). Both audiences apply; future work should confirm which is in scope.

## Product Purpose

A web-based movie-ticket booking system (`TKPM` / `KE_HOACH_HE_THONG_DAT_VE_XEM_PHIM`). Confirmed capabilities from the plan document:
- View movie list and movie details.
- View showtimes by movie, date, cinema, or room.
- Select a showtime.
- View seat diagram with states: empty, selecting, booked.
- Book one or more seats.
- Simulated payment (success / failure states).
- Receive booking code after successful payment.
- Basic admin: manage movies, rooms, seats, showtimes; view booking list and payment status.
Non-functional commitments from the plan: Docker Compose independent deployment; MySQL + phpMyAdmin; Nginx reverse proxy with HTTPS/self-signed or basic security headers; monitoring (Prometheus + Grafana); centralized logging (Loki + Promtail); no committed secrets.

Positioning / difference is not fully articulated in evidence; the product is a student/course project with explicit architecture and monitoring requirements rather than a commercial differentiated offering.

## Operating Context

Course/project context (Vietnamese document): repository name suggested as `MSSV-movie-ticket`; GitHub-hosted; three required milestone commits (app + infra; monitoring; centralized logging); deliverables include UI screenshots, database verification, Docker running state, Prometheus targets UP, Grafana dashboards, LogQL queries, and Git history.

Current session context: code-first build path selected; no image generation workflow stored yet (`buildPath` not set in `.impeccable/config.json` — will be recorded separately if user confirms).

## Capabilities and Constraints

Confirmed capabilities (from `KE_HOACH_HE_THONG_DAT_VE_XEM_PHIM.md`):
- Movie listing and details.
- Showtimes by movie/date/cinema/room.
- Seat selection with state tracking.
- Booking creation with unique constraint on `showtime_id` + `seat_id`.
- Simulated payment (`success` / `failure`).
- Booking code generation on success.
- Admin CRUD for movies, rooms, seats, showtimes.
- Viewing booking list and payment status.
- Monitoring endpoint `/metrics` for Express.
- Security: parameterized queries / ORM; no plaintext passwords; `.env` excluded from Git; Nginx security headers; only Nginx exposed externally.

Confirmed constraints:
- Database: MySQL 8.
- Web application: Node.js + Express (per document), though user selected static HTML/CSS for current build.
- Reverse proxy: Nginx.
- Packaging: Docker + Docker Compose.
- Monitoring: Prometheus, Grafana, cAdvisor, mysqld-exporter.
- Logging: Loki + Promtail; LogQL queries required.
- HTTPS via self-signed cert or at minimum basic security headers.
- Repo must include `.env.example`, `.gitignore`, README, `docker-compose.yml`, `Dockerfile`, Nginx config, monitoring and logging configs.
- Three milestone commits required with specific messages.
- No real secrets committed; use `.env` excluded from Git.

Open / undecided:
- Whether the current session's static HTML/CSS selection replaces the full Node/Express/Docker architecture or is a temporary surface build.
- Final brand identity beyond project folder name `TKPM`.
- Whether native/iOS/Android adaptations are in scope (platform is web).

## Brand Commitments

Name: `TKPM` (derived from project folder `D:\TKPM`). No formal logo, color system, or identity assets confirmed. Existing Vietnamese document uses the description "hệ thống đặt vé xem phim" (movie ticket booking system). No binding visual direction provided; future design work should either honor the architecture document's plain/functional tone or propose a replacement world through `new-work`.

## Evidence on Hand

- `D:\TKPM\KE_HOACH_HE_THONG_DAT_VE_XEM_PHIM.md` — full Vietnamese plan defining scope, architecture, database schema, deployment, security, monitoring, logging, commit milestones, and deliverables.
- `D:\TKPM\.claude/skills/impeccable/reference/init.md` — this skill's init reference.
- `D:\TKPM\.impeccable/config.local.json` — hook consent `accepted`.
- No `PRODUCT.md`, no `DESIGN.md`, no existing visual implementation, no screenshot fixtures.
- No committed assets (logos, imagery, typography files).

No fabricated testimonials, customers, benchmarks, pricing, or licensing claims are present or should be added.

## Product Principles

1. The system must run independently via Docker Compose with the full service stack (app, MySQL, phpMyAdmin, Nginx, monitoring, logging) as described in the plan.
2. Data integrity for seat booking is non-negotiable: unique `showtime_id` + `seat_id` constraint; failed payments must not confirm a booking.
3. Security by default: hashed passwords, parameterized queries, excluded `.env`, basic security headers, only Nginx exposed.
4. Observability is a first-class deliverable, not an afterthought: `/metrics`, Prometheus targets UP, Grafana dashboards, LogQL queries must be demonstrable.

## Accessibility & Inclusion

Not specifically addressed in the existing plan document. As a web application intended for general movie-booking users, standard web accessibility (keyboard navigable seat selection, sufficient contrast, readable text, alternative descriptions for seat-state icons) should be considered in any future design or build work. No specific standard (e.g., WCAG level) is confirmed; record if a target is chosen.

## Workflow / Build Default

- Build path: `code-first` (user-selected), recorded in `.impeccable/config.json` (`"buildPath": "code"`).
- Image generation: no `IMAGE_GEN_AVAILABLE` trace in boot; assume unavailable unless a harness-native image tool is present.
- Platform reference loaded: none (platform `web` does not trigger `ios.md` or `android.md`).

## Open Decisions (deliberately undecided)

- Whether the static HTML/CSS selection supersedes the Node/Express/Docker architecture described in the plan, or is only for a visual surface of that architecture.
- Final brand name and identity beyond `TKPM`.
- Specific accessibility target (if any).
