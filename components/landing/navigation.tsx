"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

export function Navigation() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(45,212,191,0.12)] bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-8 w-8 rounded-full bg-[conic-gradient(from_210deg,var(--teal),var(--navy),var(--teal))] shadow-glow">
            <div className="absolute inset-1 rounded-full bg-ink" />
          </div>
          <div>
            <div className="font-display text-lg font-extrabold tracking-tight">Octivate</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-faint">
              octivate.io
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hidden text-sm text-mist hover:text-foam sm:inline">
            Workspace
          </Link>
          <Link href="/dashboard">
            <Button size="sm">Enter workspace</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden pt-28 pb-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(45,212,191,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(70% 60% at 50% 30%, #000 25%, transparent 75%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal">
            Agentic decision intelligence
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.05] tracking-tight">
            Octivate
          </h1>
          <p className="mt-4 max-w-[42ch] text-lg text-mist">
            Turn a strategic question into a validated, evidence-backed decision brief — built for
            Caribbean markets first.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button>
                Open workspace
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/operator">
              <Button variant="ghost">Operator console</Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.55 }}
          className="mt-16 grid gap-4 sm:grid-cols-3"
        >
          {[
            { t: "Eight agents", d: "Intake through monitoring — structured analyst workflow." },
            { t: "Evidence first", d: "Tiered sources, confidence scores, explicit gaps." },
            { t: "PSN framework", d: "Power, Systems, Narratives for regional decisions." },
          ].map((item) => (
            <div
              key={item.t}
              className="rounded-lg border border-[rgba(45,212,191,0.14)] bg-white/[0.03] p-4"
            >
              <div className="font-display text-lg font-semibold text-foam">{item.t}</div>
              <p className="mt-1 text-sm text-mist">{item.d}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
