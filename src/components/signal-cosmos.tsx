"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  depth: number;
  size: number;
  phase: number;
};

type Meteor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  length: number;
};

type Ripple = {
  x: number;
  y: number;
  age: number;
  power: number;
};

function seededValue(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function SignalCosmos() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.parentElement;
    if (!canvas || !section) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let previousTime = performance.now();
    let nextMeteor = previousTime + 550;
    let stars: Star[] = [];
    const meteors: Meteor[] = [];
    const ripples: Ripple[] = [];
    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      speed: 0,
      active: false,
    };
    const touch = {
      id: -1,
      startX: 0,
      startY: 0,
      startTime: 0,
      longPressed: false,
      timer: 0,
    };

    const buildStars = () => {
      const count = width < 700 ? 30 : Math.min(64, Math.floor(width / 22));
      stars = Array.from({ length: count }, (_, index) => ({
        x: seededValue(index, 1) * width,
        y: seededValue(index, 2) * height,
        depth: 0.35 + seededValue(index, 3) * 0.9,
        size: 0.6 + seededValue(index, 4) * 1.4,
        phase: seededValue(index, 5) * Math.PI * 2,
      }));
    };

    const resize = () => {
      const bounds = section.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      buildStars();
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const bounds = section.getBoundingClientRect();
      pointer.targetX = clientX - bounds.left;
      pointer.targetY = clientY - bounds.top;
      pointer.active = true;
    };

    const onPointerMove = (event: PointerEvent) => {
      const previousX = pointer.targetX;
      const previousY = pointer.targetY;
      updatePointer(event.clientX, event.clientY);
      pointer.speed = Math.min(
        1,
        Math.hypot(pointer.targetX - previousX, pointer.targetY - previousY) /
          38,
      );
    };
    const onPointerDown = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY);
      if (event.pointerType !== "touch") {
        ripples.push({ x: pointer.targetX, y: pointer.targetY, age: 0, power: 1 });
        return;
      }
      touch.id = event.pointerId;
      touch.startX = pointer.targetX;
      touch.startY = pointer.targetY;
      touch.startTime = performance.now();
      touch.longPressed = false;
      window.clearTimeout(touch.timer);
      touch.timer = window.setTimeout(() => {
        if (touch.id !== event.pointerId) return;
        touch.longPressed = true;
        ripples.push({
          x: pointer.targetX,
          y: pointer.targetY,
          age: 0,
          power: 1.55,
        });
      }, 520);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || event.pointerId !== touch.id) return;
      window.clearTimeout(touch.timer);
      const elapsed = Math.max(1, performance.now() - touch.startTime);
      const distance = Math.hypot(
        pointer.targetX - touch.startX,
        pointer.targetY - touch.startY,
      );
      const gestureSpeed = (distance / elapsed) * 1000;
      if (touch.longPressed) {
        ripples.push({
          x: pointer.targetX,
          y: pointer.targetY,
          age: 0,
          power: 2.1,
        });
      } else if (distance > 58 && gestureSpeed > 430) {
        spawnSwipeMeteor(
          touch.startX,
          touch.startY,
          pointer.targetX,
          pointer.targetY,
          gestureSpeed,
        );
      } else if (distance < 18) {
        ripples.push({
          x: pointer.targetX,
          y: pointer.targetY,
          age: 0,
          power: 1,
        });
      }
      touch.id = -1;
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== touch.id) return;
      window.clearTimeout(touch.timer);
      touch.id = -1;
    };
    const onPointerLeave = () => {
      pointer.active = false;
      pointer.targetX = width / 2;
      pointer.targetY = height / 2;
    };

    const spawnMeteor = () => {
      const speed = 8.5 + Math.random() * 4.5;
      meteors.push({
        x: width * (0.42 + Math.random() * 0.72),
        y: -30 + Math.random() * height * 0.32,
        vx: -speed,
        vy: speed * (0.38 + Math.random() * 0.18),
        life: 0,
        maxLife: 76 + Math.random() * 48,
        length: 120 + Math.random() * 125,
      });
    };

    const spawnSwipeMeteor = (
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      gestureSpeed: number,
    ) => {
      const distance = Math.hypot(endX - startX, endY - startY);
      if (distance < 1) return;
      const scale = (9 + Math.min(7, gestureSpeed * 0.045)) / distance;
      meteors.push({
        x: endX,
        y: endY,
        vx: (endX - startX) * scale,
        vy: (endY - startY) * scale,
        life: 0,
        maxLife: 72 + Math.min(48, gestureSpeed * 0.15),
        length: 145 + Math.min(150, gestureSpeed * 0.65),
      });
    };

    const draw = (time: number) => {
      const isDark = document.documentElement.classList.contains("dark");
      const delta = Math.min(2, (time - previousTime) / 16.67);
      previousTime = time;
      pointer.speed *= 0.93;
      pointer.x += (pointer.targetX - pointer.x) * 0.065;
      pointer.y += (pointer.targetY - pointer.y) * 0.065;
      context.clearRect(0, 0, width, height);

      const offsetX = pointer.active ? (pointer.x / width - 0.5) * 20 : 0;
      const offsetY = pointer.active ? (pointer.y / height - 0.5) * 14 : 0;
      const positions = stars.map((star) => {
        let x = star.x - offsetX * star.depth;
        let y = star.y - offsetY * star.depth;
        const pointerDistance = Math.hypot(x - pointer.x, y - pointer.y);
        if (pointer.active && pointerDistance < 180) {
          const pull = (1 - pointerDistance / 180) * 10;
          x += ((pointer.x - x) / Math.max(pointerDistance, 1)) * pull;
          y += ((pointer.y - y) / Math.max(pointerDistance, 1)) * pull;
        }
        return { x, y, star };
      });

      context.lineWidth = 0.9;
      positions.forEach((point, index) => {
        for (let next = index + 1; next < positions.length; next += 1) {
          const other = positions[next];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance > 118) continue;
          context.strokeStyle = `rgba(${isDark ? "105, 232, 222" : "42, 103, 145"}, ${
            (1 - distance / 118) * (isDark ? 0.3 : 0.24)
          })`;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }

        if (pointer.active) {
          const pointerDistance = Math.hypot(
            point.x - pointer.x,
            point.y - pointer.y,
          );
          if (pointerDistance < 205) {
            context.strokeStyle = `rgba(${isDark ? "151, 248, 239" : "45, 113, 159"}, ${
              (1 - pointerDistance / 205) *
              (isDark ? 0.58 : 0.44) *
              (1 + pointer.speed * 0.55)
            })`;
            context.lineWidth = 1.05 + pointer.speed * 0.9;
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(pointer.x, pointer.y);
            context.stroke();
            context.lineWidth = 0.9;
          }
        }

        const glow =
          0.52 + Math.sin(time * 0.0016 + point.star.phase) * 0.28;
        context.fillStyle = `rgba(${isDark ? "188, 255, 247" : "35, 102, 142"}, ${
          glow * (isDark ? 1 : 0.72)
        })`;
        context.beginPath();
        context.arc(point.x, point.y, point.star.size, 0, Math.PI * 2);
        context.fill();
      });

      if (pointer.active) {
        const halo = context.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          34 + pointer.speed * 18,
        );
        halo.addColorStop(
          0,
          `rgba(${isDark ? "193,255,247" : "42,105,153"},${
            0.3 + pointer.speed * 0.2
          })`,
        );
        halo.addColorStop(
          1,
          `rgba(${isDark ? "74,220,205" : "58,129,174"},0)`,
        );
        context.fillStyle = halo;
        context.beginPath();
        context.arc(pointer.x, pointer.y, 34 + pointer.speed * 18, 0, Math.PI * 2);
        context.fill();
      }

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        ripple.age += delta;
        const progress = ripple.age / 54;
        const radius = 18 + progress * 185 * ripple.power;
        const alpha = Math.max(0, 1 - progress);
        context.strokeStyle = `rgba(${isDark ? "135,255,239" : "39,107,155"},${
          alpha * (isDark ? 0.55 : 0.42)
        })`;
        context.lineWidth =
          (1.8 - progress * 0.8) * Math.min(1.45, ripple.power);
        context.beginPath();
        context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        context.stroke();

        positions.forEach((point) => {
          const distance = Math.hypot(point.x - ripple.x, point.y - ripple.y);
          if (Math.abs(distance - radius) > 25) return;
          context.strokeStyle = `rgba(${isDark ? "178,255,246" : "34,91,141"},${
            alpha * 0.46
          })`;
          context.lineWidth = 0.9;
          context.beginPath();
          context.moveTo(ripple.x, ripple.y);
          context.lineTo(point.x, point.y);
          context.stroke();
        });

        if (progress >= 1) ripples.splice(index, 1);
      }

      if (!reducedMotion && time >= nextMeteor) {
        spawnMeteor();
        nextMeteor = time + 1050 + Math.random() * 1850;
      }

      for (let index = meteors.length - 1; index >= 0; index -= 1) {
        const meteor = meteors[index];
        meteor.x += meteor.vx * delta;
        meteor.y += meteor.vy * delta;
        meteor.life += delta;
        const progress = meteor.life / meteor.maxLife;
        const alpha = Math.sin(Math.min(1, progress) * Math.PI) * 0.96;
        const magnitude = Math.hypot(meteor.vx, meteor.vy);
        const tailX = meteor.x - (meteor.vx / magnitude) * meteor.length;
        const tailY = meteor.y - (meteor.vy / magnitude) * meteor.length;
        const gradient = context.createLinearGradient(
          tailX,
          tailY,
          meteor.x,
          meteor.y,
        );
        gradient.addColorStop(
          0,
          isDark ? "rgba(103, 173, 255, 0)" : "rgba(68, 118, 183, 0)",
        );
        gradient.addColorStop(
          0.65,
          `rgba(${isDark ? "118, 232, 255" : "66, 126, 183"}, ${
            alpha * (isDark ? 0.34 : 0.24)
          })`,
        );
        gradient.addColorStop(
          1,
          `rgba(${isDark ? "238, 255, 252" : "37, 91, 143"}, ${
            alpha * (isDark ? 1 : 0.68)
          })`,
        );
        context.strokeStyle = gradient;
        context.lineWidth = isDark ? 2.35 : 1.9;
        context.shadowColor = isDark
          ? "rgba(113, 230, 255, .8)"
          : "rgba(53, 112, 170, .42)";
        context.shadowBlur = isDark ? 12 : 7;
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(meteor.x, meteor.y);
        context.stroke();
        context.shadowBlur = 0;
        context.strokeStyle = `rgba(${isDark ? "225,255,252" : "39,91,143"},${
          alpha * (isDark ? 0.72 : 0.5)
        })`;
        context.lineWidth = 0.75;
        context.beginPath();
        context.moveTo(
          meteor.x - (meteor.vx / magnitude) * meteor.length * 0.42,
          meteor.y - (meteor.vy / magnitude) * meteor.length * 0.42,
        );
        context.lineTo(meteor.x, meteor.y);
        context.stroke();
        context.fillStyle = `rgba(${isDark ? "255,255,255" : "35,82,132"},${
          alpha * (isDark ? 1 : 0.72)
        })`;
        context.shadowColor = isDark
          ? "rgba(205, 255, 250, .95)"
          : "rgba(42, 99, 151, .55)";
        context.shadowBlur = isDark ? 16 : 9;
        context.beginPath();
        context.arc(meteor.x, meteor.y, isDark ? 2.6 : 2.2, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
        if (meteor.life >= meteor.maxLife) meteors.splice(index, 1);
      }

      frame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(section);
    section.addEventListener("pointermove", onPointerMove);
    section.addEventListener("pointerdown", onPointerDown);
    section.addEventListener("pointerup", onPointerUp);
    section.addEventListener("pointercancel", onPointerCancel);
    section.addEventListener("pointerleave", onPointerLeave);
    resize();
    pointer.x = pointer.targetX = width / 2;
    pointer.y = pointer.targetY = height / 2;
    frame = requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerdown", onPointerDown);
      section.removeEventListener("pointerup", onPointerUp);
      section.removeEventListener("pointercancel", onPointerCancel);
      section.removeEventListener("pointerleave", onPointerLeave);
      window.clearTimeout(touch.timer);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas className="signal-cosmos" ref={canvasRef} aria-hidden />;
}
