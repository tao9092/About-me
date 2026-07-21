"use client";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useScroll,
} from "framer-motion";
import type { MouseEvent, ReactNode } from "react";

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 1, y: 22 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.72, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function AurosHeroMotion({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 45, damping: 18 });
  const sy = useSpring(my, { stiffness: 45, damping: 18 });
  const { scrollY } = useScroll();
  const scroll = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 85]);
  function move(e: MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left - r.width / 2) / 30);
    my.set((e.clientY - r.top - r.height / 2) / 30);
  }
  return (
    <motion.div
      className="auros-hero-motion"
      onMouseMove={move}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      style={{ x: sx, y: sy }}
    >
      <motion.div
        style={{ translateY: scroll }}
        initial={false}
        animate={reduce ? undefined : { opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function LineRise({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <span className="auros-line-mask">
      <motion.span
        initial={false}
        animate={reduce ? undefined : { y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export function DataOrb({
  size = "large",
  index = 0,
}: {
  size?: "large" | "medium" | "small";
  index?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`data-orb data-orb-${size}`}
      animate={
        reduce
          ? undefined
          : { y: [0, -12, 0], rotate: [0, index % 2 ? 4 : -4, 0] }
      }
      transition={{
        duration: 7 + index * 1.3,
        repeat: Infinity,
        ease: "easeInOut",
        delay: index * 0.4,
      }}
    >
      <span />
      <i />
      <b />
    </motion.div>
  );
}
