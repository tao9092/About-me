"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";

export function MechanicalClockScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const birds: THREE.Line[] = [];
    const birdMaterial = new THREE.LineBasicMaterial({
      color: 0x3a332a,
      transparent: true,
      opacity: 0.68,
    });

    for (let index = 0; index < 7; index += 1) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.14, 0, 0),
        new THREE.Vector3(0, 0.075, 0),
        new THREE.Vector3(0.14, 0, 0),
      ]);
      const bird = new THREE.Line(geometry, birdMaterial);
      bird.position.set(-9 + index * 2.7, 2.5 + (index % 3) * 0.52, 1);
      bird.scale.setScalar(0.7 + (index % 3) * 0.15);
      scene.add(bird);
      birds.push(bird);
    }

    const moteCount = 90;
    const motePositions = new Float32Array(moteCount * 3);
    for (let index = 0; index < moteCount; index += 1) {
      motePositions[index * 3] = (Math.random() - 0.5) * 18;
      motePositions[index * 3 + 1] = (Math.random() - 0.5) * 8;
      motePositions[index * 3 + 2] = Math.random() * 4;
    }
    const moteGeometry = new THREE.BufferGeometry();
    moteGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(motePositions, 3),
    );
    const moteMaterial = new THREE.PointsMaterial({
      color: 0xffe7b0,
      size: 0.025,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const motes = new THREE.Points(moteGeometry, moteMaterial);
    scene.add(motes);

    let pointerX = 0;
    let pointerY = 0;
    const handlePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / rect.width - 0.5;
      pointerY = (event.clientY - rect.top) / rect.height - 0.5;
    };
    canvas.parentElement?.addEventListener("pointermove", handlePointer);
    const sceneRoot = canvas.parentElement;
    const handleScroll = () => {
      if (!sceneRoot) return;
      const rect = sceneRoot.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const sectionCenter = rect.top + rect.height / 2;
      const offset = Math.max(
        -18,
        Math.min(18, (sectionCenter - viewportCenter) * -0.025),
      );
      sceneRoot.style.setProperty("--scene-scroll", `${offset}px`);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    const resize = () => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      camera.aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const clock = new THREE.Clock();
    let animationFrame = 0;

    const render = () => {
      const elapsed = clock.getElapsedTime();
      if (!reducedMotion) {
        birds.forEach((bird, index) => {
          bird.position.x =
            ((elapsed * (0.42 + index * 0.022) + index * 2.7 + 9) % 18) - 9;
          bird.position.y =
            2.5 + (index % 3) * 0.52 + Math.sin(elapsed + index) * 0.13;
          bird.scale.y = 0.72 + Math.sin(elapsed * 4.4 + index) * 0.25;
        });
        motes.rotation.y = elapsed * 0.012;
        motes.position.y = Math.sin(elapsed * 0.24) * 0.08;
        camera.position.x += (pointerX * 0.18 - camera.position.x) * 0.018;
        camera.position.y += (-pointerY * 0.1 - camera.position.y) * 0.018;
      }
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      canvas.parentElement?.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("scroll", handleScroll);
      birds.forEach((bird) => bird.geometry.dispose());
      birdMaterial.dispose();
      moteGeometry.dispose();
      moteMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas className="mechanical-clock-canvas" ref={canvasRef} aria-hidden />;
}
