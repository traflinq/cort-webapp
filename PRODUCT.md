# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: company admins.** Facilities, HR and daily transport-operations managers at client companies, working in the company portal (`/company`). Their job: keep employee transport running and spending under control, and see where money is leaking. When needs conflict, this user wins.
- **Supporting: Traflinq's operations team** (Super Admin / internal staff, `/admin`), who run the managed service for clients: onboarding, rosters, route assignment, pricing contracts, invoicing, driver and vehicle approval.
- **Supporting: transport vendors** (`/vendor`, `/cort-vendor`), who manage their fleets, drivers, trips and routes for client companies.
- Employees (passengers) and drivers use the mobile apps; on the web they only reach public pages such as the ride-share link (`/r/[token]`).

## Product Purpose

Traflinq is "The Operating System for Corporate Mobility": one platform for a company's daily employee commute (fixed-route shuttles) and on-demand chauffeur rides, run as a managed service.

The main outcome the product must prove to a client is **money saved**: find cost leakage (billing leaks, route redundancies, idle or under-used vehicles, vendor over-charging) and show the savings. Reliable daily operations come second, with **live tracking** the most important part of operations.

Success for a company admin: they can see at a glance what they are spending, where it is leaking, what to do about it, and that today's transport is running.

## Positioning

Traflinq audits transport costs from the company's own trip, fuel, roster and occupancy data and turns them into ranked, priced savings opportunities, while also running the transport itself (shuttles, chauffeur, vendors) on the same platform. Savings are estimated from real operating data, not generic benchmarks.

## Operating Context

- Company admins check the overview dashboard daily: headline figures, savings opportunities, live operations, spend against a monthly budget, and what needs action (unassigned bookings, outstanding invoices, high-priority leakage).
- Deeper work happens in Analytics (cost optimisation, fleet analytics), bookings, route rosters, shuttle and chauffeur reports, invoices, vendors and employees.
- Money is in PKR, shown as full amounts.
- Fulfilment differs by company: Traflinq-managed chauffeur (billed), self-managed (own drivers, never billed) and external-vendor trips. Spend figures only make sense for billed fulfilment.

## Capabilities and Constraints

- Services per company: chauffeur and/or shuttle; surfaces show only what a company runs.
- Savings report can be locked per company; locked companies see the headline total but not per-opportunity amounts.
- AI insights are a per-company feature flag.
- **The market-rate vs Traflinq-rate difference is not a saving.** Never present it as savings anywhere (it is stored per trip as `savings_amount` and summed into the dashboard API's `chauffeur.totalSavings`). Real savings are cost leakage found in the company's own data and measured before/after comparisons against the company's own previous vendor costs.
- Market today: **Pakistan** (Karachi and Lahore). **Saudi Arabia and Arabic** are upcoming: the code already has Arabic translations, RTL support and `/sa` routes, so keep them working, but they are not live markets yet.
- Stack: Next.js (App Router) web app in this repo; NestJS + Prisma + PostgreSQL backend in `../cort-backend`.

## Brand Commitments

- Customer-facing name: **Traflinq** (capital T only, one word). "Cort" is a legacy internal name (PRD, enum values like `CORT_MANAGED`) and never appears to users; "TrafLinq" is a misspelling to fix where found.
- Voice (from traflinq.com): confident, short and plain. Website phrases include "One Platform. Every Employee Moves." and "Eliminate billing leaks & route redundancies."
- Logo assets: `public/app_icon.png`, `public/traflinq_light_no_tagline*.png|svg`, `public/traflinq_dark_no_tagline*.png|svg`.

## Evidence on Hand

- Website proof point: "Used by 40+ fleets in Karachi & Lahore."
- No client logos, testimonials or published savings percentages exist; do not invent any.
- Real per-company figures come only from the API (dashboard stats, cost optimisation, savings dashboard).

## Product Principles

1. **Savings first.** On client surfaces, cost leakage and money saved lead; everything else supports them.
2. **Live operations stay close.** Tracking what is moving right now comes right after savings.
3. **Only real numbers.** Every figure comes from the company's own data; missing data shows as missing, never as an estimate dressed up as fact.
4. **Show only what applies.** Each company sees the services, figures and actions that match how it runs.
5. **Action over reporting.** Pair each problem with the next step (assign a driver, see how to save, pay an invoice).
