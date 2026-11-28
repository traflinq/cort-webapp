import Link from "next/link";
import {
  ShieldCheck,
  MapPin,
  Car,
  FileText,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Building2,
  Smartphone
} from "@/app/components/icons";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-orange/20 selection:text-orange">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img
              src="/cort-with-at-your.svg"
              alt="Cort"
              className="h-10 w-auto"
            />
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="group inline-flex items-center justify-center rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-navy/90 hover:shadow-lg hover:shadow-navy/20 active:scale-95"
            >
              Sign In
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-surface to-white pt-24 pb-32">
          {/* Background decoration */}
          <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 -z-10 h-[400px] w-[400px] translate-y-1/3 rounded-full bg-orange/5 blur-3xl" />

          <div className="mx-auto max-w-7xl px-6 text-center">
            <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-blue/20 bg-blue/5 px-3 py-1 text-xs font-medium text-blue">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue"></span>
              </span>
              v2.1 Enterprise Availability
            </div>


            <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-navy sm:text-6xl lg:text-7xl">
              Enterprise Mobility, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange to-purple">
                Simplified.
              </span>
            </h1>

            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted">
              The complete operating system for corporate logistics. Digitize your
              Fixed Route Shuttles and On-Demand Chauffeur services with a
              fully managed, hybrid fleet solution.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-orange px-8 text-base font-semibold text-white transition-all hover:bg-orange/90 hover:shadow-lg hover:shadow-orange/25 active:scale-95"
              >
                Access Portal
              </Link>
              <a
                href="#features"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-white px-8 text-base font-medium text-navy transition-all hover:bg-surface hover:text-orange active:scale-95"
              >
                Explore Modules
              </a>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="border-y border-border bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border md:grid-cols-4">
            {[
              { label: "Active Operations", value: "Nationwide", icon: MapPin },
              { label: "Managed Fleet", value: "Hybrid Model", icon: Car },
              { label: "User Satisfaction", value: "98.5%", icon: CheckCircle2 },
              { label: "Uptime", value: "99.9%", icon: BarChart3 },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center bg-white p-8 text-center transition-colors hover:bg-surface/50">
                <stat.icon className="mb-3 h-6 w-6 text-muted" />
                <div className="text-2xl font-bold text-navy">{stat.value}</div>
                <div className="text-sm font-medium text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-surface/30">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16 md:text-center">
              <h2 className="text-base font-semibold uppercase tracking-wider text-orange">
                Platform Capabilities
              </h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
                Everything you need to run operations.
              </p>
              <p className="mt-4 max-w-2xl text-lg text-muted md:mx-auto">
                From simple bookings to complex contract automation, Cort handles the heavy lifting
                so you can focus on your core business.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {/* Feature Cards */}
              {[
                {
                  title: "Super Admin Control",
                  desc: "The 'God Mode' for operations. Approve drivers, whitelist vehicles, assign routes, and configure pricing contracts from a single dashboard.",
                  icon: ShieldCheck,
                  color: "text-purple"
                },
                {
                  title: "Smart Booking Engine",
                  desc: "Intelligent dispatch system that matches employee requests with whitelisted vehicles based on contract rules and availability.",
                  icon: Smartphone,
                  color: "text-blue"
                },
                {
                  title: "Hybrid Fleet Management",
                  desc: "Seamlessly manage both private fixed-route shuttles and gig-economy chauffeurs in a unified system.",
                  icon: Car,
                  color: "text-orange"
                },
                {
                  title: "Company Portals",
                  desc: "Dedicated self-service portals for clients to manage employee rosters, view live tracking, and monitor spend.",
                  icon: Building2,
                  color: "text-teal"
                },
                {
                  title: "Automated Invoicing",
                  desc: "Dynamic financial engine that handles complex B2B invoicing, fuel price fluctuations, and contract-specific variables.",
                  icon: FileText,
                  color: "text-navy"
                },
                {
                  title: "Real-time Operations",
                  desc: "Live tracking, expense logging, and safety monitoring with integrated SOS alerts and route deviation tracking.",
                  icon: MapPin,
                  color: "text-danger"
                }
              ].map((feature, i) => (
                <div key={i} className="group relative overflow-hidden rounded-2xl border border-border bg-white p-8 transition-all hover:border-orange/30 hover:shadow-xl hover:shadow-orange/5">
                  <div className={`mb-4 inline-flex rounded-xl bg-surface p-3 ${feature.color} ring-1 ring-inset ring-black/5`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-navy">{feature.title}</h3>
                  <p className="text-muted leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* User Roles Section */}
        <section className="py-24 bg-white">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-base font-semibold uppercase tracking-wider text-blue">
                  Ecosystem
                </h2>
                <p className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
                  Built for every stakeholder.
                </p>
                <p className="mt-4 text-lg text-muted">
                  Four distinct interfaces designed to streamline communication and operations across your entire organization.
                </p>

                <div className="mt-8 space-y-6">
                  {[
                    { role: "Super Admin", desc: "Configuration, Approvals, & Global Oversight" },
                    { role: "Company Admin", desc: "Booking Management & Employee Rostering" },
                    { role: "Drivers", desc: "Dedicated Apps for Shuttle & Chauffeur flows" },
                    { role: "Employees", desc: "Unified Passenger App for all transport needs" },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue/10 text-blue">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-navy">{item.role}</h4>
                        <p className="text-sm text-muted">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative rounded-2xl bg-surface p-2 ring-1 ring-black/5 lg:order-last">
                <div className="absolute -top-12 -right-12 h-64 w-64 rounded-full bg-purple/10 blur-3xl" />
                <div className="absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-blue/10 blur-3xl" />
                <div className="relative overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
                  {/* Mock UI Representation */}
                  <div className="border-b border-border bg-surface/50 px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-400" />
                      <div className="h-3 w-3 rounded-full bg-amber-400" />
                      <div className="h-3 w-3 rounded-full bg-green-400" />
                    </div>
                    <div className="ml-2 h-6 w-64 rounded bg-white shadow-sm border border-border/50" />
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="flex gap-4">
                      <div className="h-32 w-1/3 rounded-lg bg-surface animate-pulse" />
                      <div className="h-32 w-1/3 rounded-lg bg-surface animate-pulse delay-75" />
                      <div className="h-32 w-1/3 rounded-lg bg-surface animate-pulse delay-150" />
                    </div>
                    <div className="space-y-3">
                      <div className="h-4 w-3/4 rounded bg-surface" />
                      <div className="h-4 w-1/2 rounded bg-surface" />
                      <div className="h-4 w-5/6 rounded bg-surface" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className="bg-navy py-24 text-center">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to modernize your fleet?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-blue-100">
              Join the growing list of enterprises using Cort for smarter,
              faster, and more efficient corporate mobility.
            </p>
            <div className="mt-10">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-3 text-base font-bold text-navy transition-all hover:bg-white/90 active:scale-95"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Simple Footer */}
        <footer className="border-t border-border bg-white py-12">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <img src="/cort-with-at-your.svg" alt="Cort" className="h-8 w-auto grayscale opacity-50" />
              <span className="text-sm text-muted">© 2026 Cort Operations. All rights reserved.</span>
            </div>
            <div className="flex gap-6">
              <span className="text-sm text-muted hover:text-navy cursor-pointer">Privacy Policy</span>
              <span className="text-sm text-muted hover:text-navy cursor-pointer">Terms of Service</span>
              <span className="text-sm text-muted hover:text-navy cursor-pointer">Support</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

