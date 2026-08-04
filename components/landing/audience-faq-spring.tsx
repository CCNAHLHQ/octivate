"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Building2,
  TrendingUp,
  HeartHandshake,
  Bot,
  UserCheck,
  MapPin,
  Users,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "audience" | "faq";

const TABS: { id: TabId; label: string; eyebrow: string; icon: typeof Users }[] = [
  { id: "audience", label: "Who it's for", eyebrow: "Audiences", icon: Users },
  { id: "faq", label: "FAQ", eyebrow: "Questions", icon: HelpCircle },
];

const AUDIENCE = [
  {
    title: "Governments",
    body: "Policy analysis, procurement intelligence, regional diplomacy.",
    icon: Building2,
    accent: "#D8B4FE",
  },
  {
    title: "Investors",
    body: "Country risk, market entry, stakeholder mapping.",
    icon: TrendingUp,
    accent: "#7DEDE0",
  },
  {
    title: "NGOs & corporates",
    body: "Programme planning, regulatory monitoring, partner selection.",
    icon: HeartHandshake,
    accent: "#FFA79C",
  },
] as const;

const FAQ = [
  {
    title: "Is this a chatbot?",
    body: "No. Octivate runs a structured agentic workflow with inspectable stages, evidence tables, gaps and monitoring plans.",
    icon: Bot,
    accent: "#A855F7",
  },
  {
    title: "Who reviews briefs?",
    body: "Sensitive or low-confidence outputs can be held for human analyst review before release.",
    icon: UserCheck,
    accent: "#2DD4BF",
  },
  {
    title: "Where does it start?",
    body: "Caribbean-first coverage across CARICOM, OECS and key regional jurisdictions — expanding outward.",
    icon: MapPin,
    accent: "#F5B84B",
  },
] as const;

const spring = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.85 };

export function AudienceFaqSpring() {
  const [tab, setTab] = useState<TabId>("audience");
  const reduceMotion = useReducedMotion();

  return (
    <section className="spring-panel-section" id="audience">
      <span id="faq" className="sr-only" aria-hidden />
      <div className="container">
        <div className="spring-panel-shell reveal">
          <div className="spring-panel-glow" aria-hidden />
          <div className="spring-panel-grid">
            <header className="spring-panel-head">
              <span className="eyebrow">
                <Sparkles className="spring-panel-spark" aria-hidden />
                {TABS.find((t) => t.id === tab)?.eyebrow}
              </span>
              <h2 className="spring-panel-title">
                {tab === "audience"
                  ? "Built for teams that decide under uncertainty"
                  : "Straight answers"}
              </h2>
              <p className="spring-panel-lede">
                {tab === "audience"
                  ? "Governments, investors, and mission-driven teams use Octivate when the stakes are high and the signal is scattered."
                  : "How the pipeline works, who signs off, and where coverage begins."}
              </p>

              <div className="spring-tab-rail" role="tablist" aria-label="Audience and FAQ">
                {TABS.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={cn("spring-tab", active && "is-active")}
                      onClick={() => setTab(item.id)}
                    >
                      {active && (
                        <motion.span
                          layoutId="spring-tab-bg"
                          className="spring-tab-bg"
                          transition={reduceMotion ? { duration: 0 } : spring}
                        />
                      )}
                      <Icon className="spring-tab-icon" aria-hidden />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </header>

            <div className="spring-panel-body">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  role="tabpanel"
                  initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -10, scale: 0.99 }}
                  transition={reduceMotion ? { duration: 0 } : spring}
                  className="spring-card-grid"
                >
                  {(tab === "audience" ? AUDIENCE : FAQ).map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <motion.article
                        key={item.title}
                        className="spring-card"
                        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { ...spring, delay: 0.05 + i * 0.07 }
                        }
                        style={
                          {
                            "--spring-accent": item.accent,
                          } as React.CSSProperties
                        }
                      >
                        <div className="spring-card-icon-wrap">
                          <Icon className="spring-card-icon" aria-hidden />
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.body}</p>
                      </motion.article>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
