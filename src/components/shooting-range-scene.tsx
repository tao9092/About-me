"use client";

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useEffect, useRef } from "react";

export type RangeTarget = {
  number: string;
  title: string;
  chineseTitle: string;
  statement: string;
};

export type RangeMode = "idle" | "playing" | "paused";

type ShootingRangeSceneProps = {
  targets: RangeTarget[];
  mode: RangeMode;
  activeIndex: number | null;
  muted: boolean;
  onAim: (index: number | null) => void;
  onAds: (aiming: boolean) => void;
  onHit: (index: number) => void;
  onLockChange: (locked: boolean) => void;
};

type Sign = {
  hinge: THREE.Group;
  board: THREE.Mesh;
  face: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  holes: THREE.Mesh[];
  fall: number;
  velocity: number;
  target: number;
};

type Effect = {
  age: number;
  life: number;
  update: (delta: number, age: number) => void;
  dispose: () => void;
};

type SoundRig = {
  context: AudioContext;
  out: GainNode;
  wet: GainNode;
  noise: AudioBuffer;
};

const FLOOR_Y = -1.6;
const HINGE_Y = -0.92;
const SIGN_WIDTH = 2.4;
const SIGN_HEIGHT = 1.6;
const SIGN_DEPTH = 0.08;
const KNOCK_ANGLE = 1.42;
const YAW_LIMIT = 0.95;
const PITCH_MIN = -0.32;
const PITCH_MAX = 0.38;
const DRAG_SENSITIVITY = 0.0032;
const MOUSE_SENSITIVITY = 0.0022;
const FIRE_COOLDOWN = 170;
const HIT_OPEN_DELAY = 420;
const MAX_HOLES = 10;
const ADS_ZOOM = 0.38;
const GRAVITY = 9.8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function drawSign(
  canvas: HTMLCanvasElement,
  target: RangeTarget,
  fontFamily: string,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;

  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#2b190c");
  background.addColorStop(1, "#130b05");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width * 0.74, height * 0.5);
  for (let radius = 60; radius <= 300; radius += 60) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(215,169,81,${radius === 60 ? 0.24 : 0.09})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();

  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(215,169,81,0.07)";
  ctx.font = `600 360px ${fontFamily}`;
  ctx.fillText(target.number, width - 40, height - 60);

  ctx.strokeStyle = "rgba(215,169,81,0.55)";
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, width - 44, height - 44);
  ctx.strokeStyle = "rgba(215,169,81,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(38, 38, width - 76, height - 76);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#d7a951";
  ctx.font = `600 30px ${fontFamily}`;
  ctx.fillText("◎", width - 76, 76);
  ctx.textAlign = "left";
  ctx.fillText(`TARGET / ${target.number}`, 76, 76);

  ctx.fillStyle = "#f3dcab";
  ctx.font = `700 150px ${fontFamily}`;
  ctx.fillText(target.chineseTitle, 72, 180);

  ctx.fillStyle = "#ead9bc";
  ctx.font = `500 46px ${fontFamily}`;
  ctx.fillText(target.title.toUpperCase(), 76, 368);

  ctx.fillStyle = "rgba(215,169,81,0.45)";
  ctx.fillRect(76, 440, 120, 3);

  ctx.fillStyle = "#a88a68";
  ctx.font = `500 28px ${fontFamily}`;
  ctx.fillText(target.statement.toUpperCase(), 76, 462);

  ctx.fillStyle = "rgba(215,169,81,0.7)";
  ctx.font = `600 22px ${fontFamily}`;
  ctx.fillText("SHOOT TO OPEN", 76, height - 104);
}

function makeRadialTexture(stops: [number, string][]) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildPistol() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: 0x26211c,
    metalness: 0.75,
    roughness: 0.32,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xc08a3e,
    metalness: 0.9,
    roughness: 0.28,
  });
  const grip = new THREE.MeshStandardMaterial({
    color: 0x3a2214,
    metalness: 0.1,
    roughness: 0.75,
  });
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rotationX = 0,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rotationX;
    group.add(mesh);
    return mesh;
  };

  const slide = add(new THREE.BoxGeometry(0.1, 0.085, 0.5), steel, 0, 0.04, -0.05);
  add(new THREE.BoxGeometry(0.104, 0.012, 0.44), brass, 0, 0, -0.05);
  add(new THREE.BoxGeometry(0.088, 0.06, 0.4), steel, 0, -0.03, -0.02);
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 16), brass, 0, 0.045, -0.31, Math.PI / 2);
  add(new THREE.BoxGeometry(0.084, 0.27, 0.12), grip, 0, -0.17, 0.13, 0.28);
  add(new THREE.BoxGeometry(0.02, 0.022, 0.02), brass, 0, 0.093, -0.27);
  // Rear sight: two posts with a notch the front post sits in when aiming.
  add(new THREE.BoxGeometry(0.02, 0.022, 0.025), steel, -0.02, 0.093, 0.17);
  add(new THREE.BoxGeometry(0.02, 0.022, 0.025), steel, 0.02, 0.093, 0.17);
  add(new THREE.BoxGeometry(0.03, 0.03, 0.03), steel, 0, 0.06, 0.21, -0.4);
  add(new THREE.BoxGeometry(0.012, 0.05, 0.012), steel, 0, -0.085, 0.0, 0.3);
  const guard = add(new THREE.TorusGeometry(0.042, 0.007, 8, 24), steel, 0, -0.07, 0.01);
  guard.rotation.y = Math.PI / 2;
  for (let index = 0; index < 4; index += 1) {
    add(new THREE.BoxGeometry(0.106, 0.06, 0.006), brass, 0, 0.045, 0.1 + index * 0.025);
  }

  group.scale.setScalar(0.82);
  return { group, slide, muzzle: new THREE.Vector3(0, 0.045, -0.35) };
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points ||
      object instanceof THREE.Sprite
    ) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material: THREE.Material) => {
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) value.dispose();
        });
        material.dispose();
      });
    }
  });
}

export function ShootingRangeScene({
  targets,
  mode,
  activeIndex,
  muted,
  onAim,
  onAds,
  onHit,
  onLockChange,
}: ShootingRangeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetsRef = useRef(targets);
  const modeRef = useRef(mode);
  const activeRef = useRef(activeIndex);
  const mutedRef = useRef(muted);
  const onAimRef = useRef(onAim);
  const onAdsRef = useRef(onAds);
  const onHitRef = useRef(onHit);
  const onLockChangeRef = useRef(onLockChange);
  const syncRef = useRef<(() => void) | null>(null);
  const lockRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onAimRef.current = onAim;
    onAdsRef.current = onAds;
    onHitRef.current = onHit;
    onLockChangeRef.current = onLockChange;
    mutedRef.current = muted;
    modeRef.current = mode;
  });

  useEffect(() => {
    activeRef.current = activeIndex;
    syncRef.current?.();
  }, [activeIndex]);

  // Capture the mouse whenever the range is live and no record is open.
  useEffect(() => {
    modeRef.current = mode;
    activeRef.current = activeIndex;
    lockRef.current?.();
  }, [mode, activeIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targetList = targetsRef.current;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.autoClear = false;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envTexture = pmrem.fromScene(room, 0.04).texture;

    // World: the range the player looks into.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc4b496);
    scene.fog = new THREE.Fog(0xc4b496, 22, 75);
    scene.environment = envTexture;
    scene.environmentIntensity = 0.35;

    const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 80);
    camera.rotation.order = "YXZ";

    scene.add(new THREE.HemisphereLight(0xfff1d6, 0x6b5238, 2.2));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
    sun.position.set(5, 10, 4);
    scene.add(sun);
    const fireLight = new THREE.PointLight(0xffb45c, 0, 14, 2);
    scene.add(fireLight);

    // A curved panorama so turning the head never reveals an empty edge.
    const backdropMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.18, 1.14, 1.08),
      side: THREE.BackSide,
      toneMapped: false,
    });
    new THREE.TextureLoader().load("/gothic-clockwork-cathedral.png", (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.MirroredRepeatWrapping;
      texture.repeat.x = 2;
      texture.offset.x = 0.5;
      backdropMaterial.map = texture;
      backdropMaterial.needsUpdate = true;
    });
    const backdropArc = Math.PI * 1.15;
    const backdrop = new THREE.Mesh(
      new THREE.CylinderGeometry(26, 26, 28, 64, 1, true, Math.PI - backdropArc / 2, backdropArc),
      backdropMaterial,
    );
    backdrop.position.y = 5;
    scene.add(backdrop);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.8, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    scene.add(floor);

    const grid = new THREE.GridHelper(80, 80, 0xd2ad72, 0xa58866);
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.35;
    });
    grid.position.y = FLOOR_Y + 0.01;
    scene.add(grid);

    const ledgeMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.6 });
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.7), ledgeMaterial);
    ledge.position.set(0, -0.78, -1.55);
    scene.add(ledge);
    const ledgeTrim = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.03, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xc08a3e, metalness: 0.9, roughness: 0.3 }),
    );
    ledgeTrim.position.set(0, -0.71, -1.2);
    scene.add(ledgeTrim);

    // Targets: one hinged sign per capability.
    const fontFamily = getComputedStyle(canvas).fontFamily || "sans-serif";
    const boardGeometry = new THREE.BoxGeometry(SIGN_WIDTH, SIGN_HEIGHT, SIGN_DEPTH);
    const postGeometry = new THREE.CylinderGeometry(0.035, 0.035, HINGE_Y - FLOOR_Y, 10);
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, metalness: 0.6, roughness: 0.4 });
    const holeGeometry = new THREE.PlaneGeometry(0.11, 0.11);
    const holeMaterial = new THREE.MeshBasicMaterial({
      map: makeRadialTexture([
        [0, "rgba(0,0,0,1)"],
        [0.32, "rgba(10,5,2,0.95)"],
        [0.5, "rgba(90,55,20,0.6)"],
        [1, "rgba(0,0,0,0)"],
      ]),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });

    const signs: Sign[] = targetList.map((target, index) => {
      const x = (index - (targetList.length - 1) / 2) * 3.2;
      const z = -9 + Math.abs(x) * 0.25;
      const stand = new THREE.Group();
      stand.position.set(x, 0, z);
      stand.rotation.y = Math.atan2(-x, -z);
      scene.add(stand);

      [-0.8, 0.8].forEach((postX) => {
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(postX, (HINGE_Y + FLOOR_Y) / 2, -0.02);
        stand.add(post);
      });

      const signCanvas = document.createElement("canvas");
      signCanvas.width = 960;
      signCanvas.height = 640;
      drawSign(signCanvas, target, fontFamily);
      const texture = new THREE.CanvasTexture(signCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const face = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: 0.35,
        roughness: 0.7,
      });
      const trim = new THREE.MeshStandardMaterial({
        color: 0x8b5d2c,
        emissive: 0xd7a951,
        emissiveIntensity: 0,
        metalness: 0.8,
        roughness: 0.35,
      });
      const back = new THREE.MeshStandardMaterial({ color: 0x1c120a, roughness: 0.8 });

      const hinge = new THREE.Group();
      hinge.position.y = HINGE_Y;
      stand.add(hinge);
      const board = new THREE.Mesh(boardGeometry, [trim, trim, trim, trim, face, back]);
      board.position.y = SIGN_HEIGHT / 2;
      board.userData.index = index;
      hinge.add(board);

      const spot = new THREE.SpotLight(0xffd59a, 26, 12, 0.55, 0.6, 2);
      spot.position.set(0, 2.6, 1.6);
      spot.target.position.set(0, HINGE_Y + SIGN_HEIGHT / 2, 0);
      stand.add(spot, spot.target);

      return {
        hinge,
        board,
        face,
        trim,
        texture,
        canvas: signCanvas,
        holes: [],
        fall: 0,
        velocity: 0,
        target: 0,
      };
    });
    const boards = signs.map((sign) => sign.board);
    const environment = [floor, backdrop, ledge];

    document.fonts?.ready.then(() => {
      if (disposed) return;
      signs.forEach((sign, index) => {
        drawSign(sign.canvas, targetList[index], fontFamily);
        sign.texture.needsUpdate = true;
      });
    });

    syncRef.current = () => {
      signs.forEach((sign, index) => {
        sign.target = index === activeRef.current ? 1 : 0;
      });
    };
    syncRef.current();

    // Weapon: drawn in its own pass so it never clips into the world.
    const viewScene = new THREE.Scene();
    viewScene.environment = envTexture;
    viewScene.environmentIntensity = 0.55;
    const viewCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    viewScene.add(new THREE.HemisphereLight(0xfff0d6, 0x5a4028, 2));
    const keyLight = new THREE.DirectionalLight(0xffd7a0, 1.6);
    keyLight.position.set(-1, 2, 1);
    viewScene.add(keyLight);
    const pistol = buildPistol();
    viewScene.add(pistol.group);
    const gunBase = new THREE.Vector3(0.32, -0.3, -0.78);

    const glowTexture = makeRadialTexture([
      [0, "rgba(255,250,225,1)"],
      [0.22, "rgba(255,206,120,0.95)"],
      [0.55, "rgba(255,120,30,0.28)"],
      [1, "rgba(255,90,0,0)"],
    ]);
    const smokeTexture = makeRadialTexture([
      [0, "rgba(235,225,205,0.6)"],
      [0.5, "rgba(205,192,170,0.25)"],
      [1, "rgba(205,192,170,0)"],
    ]);
    const impactLight = new THREE.PointLight(0xffb45c, 0, 5, 2);
    scene.add(impactLight);
    const flashMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const flash = new THREE.Sprite(flashMaterial);
    flash.visible = false;
    viewScene.add(flash);
    const flashLight = new THREE.PointLight(0xffb45c, 0, 3, 2);
    viewScene.add(flashLight);

    // Shooting state.
    let yaw = 0;
    let pitch = 0;
    let targetYaw = 0;
    let targetPitch = 0;
    let recoil = 0;
    let flashTime = 0;
    let swayX = 0;
    let lastShot = 0;
    let aiming = false;
    let ads = 0;
    let baseFov = 58;
    let impactGlow = 0;
    let aimedIndex: number | null = null;
    const raycaster = new THREE.Raycaster();
    const screenCenter = new THREE.Vector2(0, 0);
    const effects: Effect[] = [];
    const timeouts: number[] = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let sound: SoundRig | null = null;

    function soundRig(): SoundRig {
      if (sound) return sound;
      const context = new AudioContext();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 8;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.2;
      compressor.connect(context.destination);
      const out = context.createGain();
      out.gain.value = 0.7;
      out.connect(compressor);

      // A short decaying-noise impulse gives the shots a room tail.
      const convolver = context.createConvolver();
      const tailLength = Math.floor(context.sampleRate * 1.6);
      const impulse = context.createBuffer(2, tailLength, context.sampleRate);
      for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);
        for (let index = 0; index < tailLength; index += 1) {
          data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / tailLength, 3.2);
        }
      }
      convolver.buffer = impulse;
      const wet = context.createGain();
      wet.gain.value = 0.32;
      wet.connect(convolver);
      convolver.connect(out);

      const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const noiseData = noise.getChannelData(0);
      for (let index = 0; index < noiseData.length; index += 1) {
        noiseData[index] = Math.random() * 2 - 1;
      }
      sound = { context, out, wet, noise };
      return sound;
    }

    function envelope(rig: SoundRig, start: number, duration: number, gain: number, reverb: boolean) {
      const node = rig.context.createGain();
      node.gain.setValueAtTime(0.0001, start);
      node.gain.exponentialRampToValueAtTime(gain, start + 0.002);
      node.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      node.connect(rig.out);
      if (reverb) node.connect(rig.wet);
      return node;
    }

    function noiseBurst(
      rig: SoundRig,
      start: number,
      duration: number,
      type: BiquadFilterType,
      frequency: number,
      gain: number,
      reverb: boolean,
    ) {
      const source = rig.context.createBufferSource();
      source.buffer = rig.noise;
      const filter = rig.context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = type === "bandpass" ? 0.9 : 0.7;
      source.connect(filter).connect(envelope(rig, start, duration, gain, reverb));
      source.start(start, Math.random() * 0.5, duration + 0.05);
    }

    function tone(
      rig: SoundRig,
      start: number,
      type: OscillatorType,
      from: number,
      to: number,
      duration: number,
      gain: number,
      reverb: boolean,
    ) {
      const oscillator = rig.context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, start);
      oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
      oscillator.connect(envelope(rig, start, duration, gain, reverb));
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    }

    function playShot(hitSign: boolean) {
      if (mutedRef.current) return;
      const rig = soundRig();
      void rig.context.resume();
      const now = rig.context.currentTime + 0.005;

      noiseBurst(rig, now, 0.045, "highpass", 2500, 0.9, true); // crack
      noiseBurst(rig, now, 0.16, "bandpass", 900, 0.8, true); // body
      tone(rig, now, "sine", 120, 38, 0.22, 0.9, false); // boom
      tone(rig, now + 0.07, "square", 1900, 1200, 0.018, 0.05, false); // slide
      noiseBurst(rig, now + 0.075, 0.03, "bandpass", 3200, 0.12, false);
      [0.42, 0.55, 0.63].forEach((delay, index) => {
        const pitch = 4200 + index * 900 + Math.random() * 400;
        tone(rig, now + delay + Math.random() * 0.03, "triangle", pitch, pitch * 0.9, 0.08, 0.035 / (index + 1), true);
      });

      if (hitSign) {
        // Steel plate ring: a few inharmonic partials.
        const hit = now + 0.035;
        [
          [523, 0.11, 0.9],
          [1287, 0.06, 0.6],
          [2161, 0.04, 0.4],
          [3320, 0.02, 0.25],
        ].forEach(([frequency, gain, duration]) => {
          tone(rig, hit, "sine", frequency, frequency * 0.995, duration, gain, true);
        });
        noiseBurst(rig, hit, 0.03, "highpass", 4000, 0.25, true);
      }
    }

    function spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
      const material = new THREE.LineBasicMaterial({
        color: 0xffd28a,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([from, to]),
        material,
      );
      scene.add(line);
      const life = 0.09;
      effects.push({
        age: 0,
        life,
        update: (_delta, age) => {
          material.opacity = 0.9 * (1 - age / life);
        },
        dispose: () => {
          scene.remove(line);
          line.geometry.dispose();
          material.dispose();
        },
      });
    }

    function spawnImpact(point: THREE.Vector3, normal: THREE.Vector3, metal: boolean) {
      const count = metal ? 46 : 30;
      const heads = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);
      const lifetimes = new Float32Array(count);
      const direction = new THREE.Vector3();
      for (let index = 0; index < count; index += 1) {
        heads.set([point.x, point.y, point.z], index * 3);
        direction.randomDirection();
        if (direction.dot(normal) < 0) direction.negate();
        direction
          .addScaledVector(normal, 0.6)
          .normalize()
          .multiplyScalar(2 + Math.random() * (metal ? 6 : 4));
        velocities.set([direction.x, direction.y, direction.z], index * 3);
        lifetimes[index] = 0.25 + Math.random() * 0.45;
      }

      // Each spark is a short motion-blurred streak with a glowing head.
      const streakPositions = new Float32Array(count * 6);
      const streakColors = new Float32Array(count * 6);
      const streakGeometry = new THREE.BufferGeometry();
      streakGeometry.setAttribute("position", new THREE.BufferAttribute(streakPositions, 3));
      streakGeometry.setAttribute("color", new THREE.BufferAttribute(streakColors, 3));
      const streakMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const streaks = new THREE.LineSegments(streakGeometry, streakMaterial);

      const glowColors = new Float32Array(count * 3);
      const glowGeometry = new THREE.BufferGeometry();
      glowGeometry.setAttribute("position", new THREE.BufferAttribute(heads, 3));
      glowGeometry.setAttribute("color", new THREE.BufferAttribute(glowColors, 3));
      const glowMaterial = new THREE.PointsMaterial({
        map: glowTexture,
        size: 0.09,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glows = new THREE.Points(glowGeometry, glowMaterial);

      const burstMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const burst = new THREE.Sprite(burstMaterial);
      burst.position.copy(point).addScaledVector(normal, 0.03);

      const smokeMaterial = new THREE.SpriteMaterial({
        map: smokeTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const smoke = new THREE.Sprite(smokeMaterial);
      smoke.position.copy(point).addScaledVector(normal, 0.08);

      const group = new THREE.Group();
      group.add(streaks, glows, burst, smoke);
      scene.add(group);
      impactLight.position.copy(point).addScaledVector(normal, 0.2);
      impactGlow = 1;

      const life = 1;
      effects.push({
        age: 0,
        life,
        update: (delta, age) => {
          const drag = 1 - 1.8 * delta;
          for (let index = 0; index < count; index += 1) {
            const offset = index * 3;
            const progress = age / lifetimes[index];
            if (progress >= 1) {
              streakColors.fill(0, index * 6, index * 6 + 6);
              glowColors.fill(0, offset, offset + 3);
              continue;
            }
            velocities[offset + 1] -= GRAVITY * delta;
            velocities[offset] *= drag;
            velocities[offset + 1] *= drag;
            velocities[offset + 2] *= drag;
            heads[offset] += velocities[offset] * delta;
            heads[offset + 1] += velocities[offset + 1] * delta;
            heads[offset + 2] += velocities[offset + 2] * delta;
            if (heads[offset + 1] < FLOOR_Y + 0.01 && velocities[offset + 1] < 0) {
              heads[offset + 1] = FLOOR_Y + 0.01;
              velocities[offset] *= 0.6;
              velocities[offset + 1] *= -0.35;
              velocities[offset + 2] *= 0.6;
            }
            const fade = 1 - progress;
            streakPositions.set(
              [
                heads[offset],
                heads[offset + 1],
                heads[offset + 2],
                heads[offset] - velocities[offset] * 0.035,
                heads[offset + 1] - velocities[offset + 1] * 0.035,
                heads[offset + 2] - velocities[offset + 2] * 0.035,
              ],
              index * 6,
            );
            const head = [fade, (0.92 - 0.4 * progress) * fade, (0.65 - 0.6 * progress) * fade];
            streakColors.set([...head, 0.6 * fade, 0.27 * fade, 0.05 * fade], index * 6);
            glowColors.set(head.map((value) => value * 0.7), offset);
          }
          streakGeometry.attributes.position.needsUpdate = true;
          streakGeometry.attributes.color.needsUpdate = true;
          glowGeometry.attributes.position.needsUpdate = true;
          glowGeometry.attributes.color.needsUpdate = true;

          burst.visible = age < 0.1;
          burst.scale.setScalar(0.1 + 0.55 * Math.max(0, 1 - age / 0.1));
          smoke.scale.setScalar(0.15 + age * 0.9);
          smoke.position.y += delta * 0.25;
          smokeMaterial.opacity = Math.min(age * 12, 1) * 0.5 * (1 - age / life);
        },
        dispose: () => {
          scene.remove(group);
          streakGeometry.dispose();
          streakMaterial.dispose();
          glowGeometry.dispose();
          glowMaterial.dispose();
          burstMaterial.dispose();
          smokeMaterial.dispose();
        },
      });
    }

    function addHole(sign: Sign, point: THREE.Vector3) {
      const local = sign.board.worldToLocal(point.clone());
      const hole = new THREE.Mesh(holeGeometry, holeMaterial);
      hole.position.set(local.x, local.y, SIGN_DEPTH / 2 + 0.002);
      hole.rotation.z = Math.random() * Math.PI;
      sign.board.add(hole);
      sign.holes.push(hole);
      if (sign.holes.length > MAX_HOLES) {
        const oldest = sign.holes.shift();
        if (oldest) sign.board.remove(oldest);
      }
    }

    function fire() {
      const now = performance.now();
      if (now - lastShot < FIRE_COOLDOWN) return;
      lastShot = now;
      recoil = aiming ? 0.55 : 1;
      flashTime = 0.06;
      targetPitch = clamp(targetPitch + 0.012, PITCH_MIN, PITCH_MAX);

      camera.updateMatrixWorld();
      raycaster.setFromCamera(screenCenter, camera);
      const hit = raycaster
        .intersectObjects([...boards, ...environment], false)
        .find((intersection) => {
          const index = intersection.object.userData.index;
          return index === undefined || signs[index].target < 0.5;
        });

      pistol.group.updateMatrixWorld();
      const muzzle = pistol.group
        .localToWorld(pistol.muzzle.clone())
        .applyMatrix4(camera.matrixWorld);
      const end = hit ? hit.point : raycaster.ray.at(40, new THREE.Vector3());
      spawnTracer(muzzle, end);
      fireLight.position.copy(muzzle);

      const hitIndex: number | undefined = hit?.object.userData.index;
      playShot(hitIndex !== undefined);
      if (!hit) return;

      const normal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : raycaster.ray.direction.clone().negate();
      spawnImpact(hit.point, normal, hitIndex !== undefined);

      if (hitIndex === undefined) return;
      const sign = signs[hitIndex];
      addHole(sign, hit.point);
      sign.target = 1;
      sign.velocity += 4;
      timeouts.push(
        window.setTimeout(() => onHitRef.current(hitIndex), HIT_OPEN_DELAY),
      );
    }

    // Input: a mouse is captured with pointer lock and turns the view by its
    // movement; touch drags to look and taps to fire; keyboard as a fallback.
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const canLock = finePointer && "requestPointerLock" in canvas;
    const isLocked = () => document.pointerLockElement === canvas;
    let drag: {
      id: number;
      x: number;
      y: number;
      moved: number;
      time: number;
    } | null = null;

    const aimFromCursor = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      const y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
      targetYaw = -x * YAW_LIMIT;
      targetPitch = y < 0 ? -y * PITCH_MAX : y * PITCH_MIN;
    };

    const isPlaying = () => modeRef.current === "playing";
    const requestLock = () => {
      if (!canLock || isLocked()) return;
      try {
        const request = canvas.requestPointerLock() as Promise<void> | undefined;
        request?.catch(() => {});
      } catch {
        // Browsers refuse a lock right after the user released one.
      }
    };
    lockRef.current = () => {
      const wantLock = isPlaying() && activeRef.current === null;
      if (wantLock) requestLock();
      else if (isLocked()) document.exitPointerLock();
    };
    const setAiming = (next: boolean) => {
      if (aiming === next) return;
      aiming = next;
      onAdsRef.current(next);
    };
    // Chorded mouse buttons arrive as pointermove, so read the button masks.
    const handleMouseButtons = (event: PointerEvent) => {
      setAiming((event.buttons & 2) !== 0);
      if (event.button === 0 && (event.buttons & 1) !== 0) fire();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!isPlaying()) return;
      if (event.pointerType === "mouse") {
        canvas.focus({ preventScroll: true });
        if (canLock && !isLocked()) {
          requestLock();
          return;
        }
        if (!canLock) aimFromCursor(event);
        handleMouseButtons(event);
        return;
      }
      if (event.button !== 0) return;
      canvas.focus({ preventScroll: true });
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: 0,
        time: performance.now(),
      };
      canvas.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!isPlaying()) return;
      if (event.pointerType === "mouse") {
        if (isLocked()) {
          targetYaw = clamp(targetYaw - event.movementX * MOUSE_SENSITIVITY, -YAW_LIMIT, YAW_LIMIT);
          targetPitch = clamp(targetPitch - event.movementY * MOUSE_SENSITIVITY, PITCH_MIN, PITCH_MAX);
        } else if (canLock) {
          return;
        } else {
          aimFromCursor(event);
        }
        if (event.button !== -1) handleMouseButtons(event);
        return;
      }
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      targetYaw = clamp(targetYaw - dx * DRAG_SENSITIVITY, -YAW_LIMIT, YAW_LIMIT);
      targetPitch = clamp(targetPitch - dy * DRAG_SENSITIVITY, PITCH_MIN, PITCH_MAX);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        setAiming((event.buttons & 2) !== 0);
        return;
      }
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.moved < 6 && performance.now() - drag.time < 500) fire();
      drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };
    const handlePointerCancel = () => {
      drag = null;
    };
    const handlePointerLeave = () => {
      if (!isLocked()) setAiming(false);
    };
    const handleLockChange = () => {
      const locked = isLocked();
      if (!locked) setAiming(false);
      onLockChangeRef.current(locked);
    };
    const handleContextMenu = (event: MouseEvent) => {
      if (isPlaying()) event.preventDefault();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPlaying()) return;
      const step = 0.09;
      switch (event.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          targetYaw = clamp(targetYaw + step, -YAW_LIMIT, YAW_LIMIT);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          targetYaw = clamp(targetYaw - step, -YAW_LIMIT, YAW_LIMIT);
          break;
        case "ArrowUp":
        case "w":
        case "W":
          targetPitch = clamp(targetPitch + step, PITCH_MIN, PITCH_MAX);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          targetPitch = clamp(targetPitch - step, PITCH_MIN, PITCH_MAX);
          break;
        case " ":
        case "Enter":
          fire();
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerCancel);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("contextmenu", handleContextMenu);
    canvas.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerlockchange", handleLockChange);

    const resize = () => {
      const width = canvas.clientWidth;
      const height = Math.max(canvas.clientHeight, 1);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      baseFov = aspect < 1 ? 70 : 58;
      camera.aspect = aspect;
      camera.fov = baseFov * (1 - ads * ADS_ZOOM);
      camera.updateProjectionMatrix();
      viewCamera.aspect = aspect;
      viewCamera.fov = baseFov;
      viewCamera.updateProjectionMatrix();
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * 0.78;
      pistol.group.scale.setScalar(aspect < 1 ? 0.58 : 0.82);
      gunBase.set(
        Math.min(0.32, halfHeight * aspect * 0.6),
        -halfHeight * 0.62,
        -0.78,
      );
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const clock = new THREE.Clock();
    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      if (modeRef.current === "idle") {
        targetYaw = reducedMotion ? 0 : Math.sin(elapsed * 0.3) * 0.28;
        targetPitch = 0.04;
      }

      const previousYaw = yaw;
      const ease = 1 - Math.exp(-delta * 14);
      yaw += (targetYaw - yaw) * ease;
      pitch += (targetPitch - pitch) * ease;
      camera.rotation.set(pitch, yaw, 0);

      if (!isPlaying()) setAiming(false);
      ads += ((aiming ? 1 : 0) - ads) * ease;
      const fov = baseFov * (1 - ads * ADS_ZOOM);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      recoil *= Math.exp(-delta * 12);
      const yawSpeed = delta > 0 ? (yaw - previousYaw) / delta : 0;
      swayX += (clamp(yawSpeed * 0.03, -0.05, 0.05) - swayX) * ease;
      const breathe = reducedMotion ? 0 : Math.sin(elapsed * 1.6) * 0.006 * (1 - ads * 0.7);
      // Aiming down sights lines the sight tops up with the screen centre.
      const sightHeight = 0.104 * pistol.group.scale.x;
      const hip = 1 - ads;
      pistol.group.position.set(
        (gunBase.x + swayX) * hip,
        gunBase.y * hip - sightHeight * ads + breathe - recoil * 0.02,
        gunBase.z * hip - 0.62 * ads + recoil * 0.07,
      );
      pistol.group.rotation.set(recoil * 0.35, (0.08 + swayX * 0.8) * hip, 0);
      pistol.slide.position.z = -0.05 + recoil * 0.06;

      flashTime -= delta;
      const flashing = flashTime > 0;
      flash.visible = flashing;
      flashLight.intensity = flashing ? 6 : 0;
      fireLight.intensity = flashing ? 18 : 0;
      impactGlow *= Math.exp(-delta * 18);
      impactLight.intensity = impactGlow * 10;
      if (flashing) {
        pistol.group.updateMatrixWorld();
        const muzzle = pistol.group.localToWorld(pistol.muzzle.clone());
        flash.position.copy(muzzle);
        flashLight.position.copy(muzzle);
        flash.scale.set(0.22 + Math.random() * 0.1, 0.18 + Math.random() * 0.08, 1);
        flashMaterial.rotation = Math.random() * Math.PI;
      }

      signs.forEach((sign) => {
        const acceleration = (sign.target - sign.fall) * 90 - sign.velocity * 11;
        sign.velocity += acceleration * delta;
        sign.fall = clamp(sign.fall + sign.velocity * delta, -0.08, 1.06);
        sign.hinge.rotation.x = -sign.fall * KNOCK_ANGLE;
      });

      camera.updateMatrixWorld();
      raycaster.setFromCamera(screenCenter, camera);
      const aimHit = raycaster.intersectObjects(boards, false)[0];
      const aimIndex: number | null = aimHit ? aimHit.object.userData.index : null;
      const nextAim = aimIndex !== null && signs[aimIndex].target < 0.5 ? aimIndex : null;
      if (nextAim !== aimedIndex) {
        aimedIndex = nextAim;
        onAimRef.current(nextAim);
      }
      signs.forEach((sign, index) => {
        const aimed = index === aimedIndex;
        sign.face.emissiveIntensity +=
          ((aimed ? 0.62 : 0.35) - sign.face.emissiveIntensity) * ease;
        sign.trim.emissiveIntensity +=
          ((aimed ? 0.45 : 0) - sign.trim.emissiveIntensity) * ease;
      });

      for (let index = effects.length - 1; index >= 0; index -= 1) {
        const effect = effects[index];
        effect.age += delta;
        if (effect.age >= effect.life) {
          effect.dispose();
          effects.splice(index, 1);
          continue;
        }
        effect.update(delta, effect.age);
      }

      renderer.clear();
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(viewScene, viewCamera);
    };

    let frame = 0;
    let running = false;
    const loop = () => {
      if (!running) return;
      frame = window.requestAnimationFrame(loop);
      tick();
    };
    const start = () => {
      if (running) return;
      running = true;
      clock.getDelta();
      frame = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { rootMargin: "120px" },
    );
    visibilityObserver.observe(canvas);

    return () => {
      disposed = true;
      stop();
      syncRef.current = null;
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerCancel);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      canvas.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerlockchange", handleLockChange);
      lockRef.current = null;
      if (isLocked()) document.exitPointerLock();
      void sound?.context.close();
      effects.forEach((effect) => effect.dispose());
      glowTexture.dispose();
      smokeTexture.dispose();
      signs.forEach((sign) => sign.holes.forEach((hole) => sign.board.remove(hole)));
      holeGeometry.dispose();
      holeMaterial.map?.dispose();
      holeMaterial.dispose();
      disposeTree(scene);
      disposeTree(viewScene);
      room.dispose();
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      className="range-canvas"
      ref={canvasRef}
      tabIndex={0}
      aria-label="First-person shooting range. Move the mouse (or drag on touch) to look around, click or press Space to fire at a capability sign, hold right-click to aim. Arrow keys also aim. Esc pauses."
    />
  );
}
