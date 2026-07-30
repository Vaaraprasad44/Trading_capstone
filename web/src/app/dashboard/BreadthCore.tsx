"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  createBreadthSim, moodLabel, SECTORS,
  type BreadthSnapshot, type BreadthStock,
} from "./breadth";

const TICK_MS = 2500; // matches the holdings drift interval

// Particle colors are intentionally NOT the theme's --up/--dn: the core
// renders additively on a deep-space background (in both themes), so it
// needs hot, luminous primaries to glow. The chips keep the theme colors.
const UP_COLOR = "#00ffa3";
const DN_COLOR = "#ff3d57";
const NEUTRAL_COLOR = "#4d4370";

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uDpr;
  attribute vec3 aColor;
  attribute float aSize;
  attribute vec4 aShift;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    // per-particle orbital drift, entirely on the GPU
    float mT = aShift.x + aShift.z * uTime;
    float mS = aShift.y + aShift.z * uTime;
    vec3 p = position + vec3(cos(mS) * sin(mT), cos(mT), sin(mS) * sin(mT)) * aShift.w;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uDpr * (3.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    // solid core with a short soft rim, plus a faint glow skirt — the demo's
    // full-sprite falloff (smoothstep 0.5->0.1) never reaches full opacity,
    // which reads as blur at our point sizes
    float core = smoothstep(0.34, 0.26, d);
    float glow = smoothstep(0.5, 0.32, d) * 0.3;
    float a = max(core, glow);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function makeShift(out: Float32Array, i: number, amp: number, speed: number) {
  out.set([
    Math.random() * Math.PI,
    Math.random() * Math.PI * 2,
    (Math.random() * 0.9 + 0.1) * speed,
    (Math.random() * 0.9 + 0.1) * amp,
  ], i * 4);
}

function ParticleCore({ stocks, reduced }: { stocks: BreadthStock[]; reduced: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Points>(null);
  const invalidate = useThree((s) => s.invalidate);
  const dpr = useThree((s) => s.gl.getPixelRatio());
  const count = stocks.length;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uTime: { value: 0 }, uDpr: { value: 1 } },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  material.uniforms.uDpr.value = dpr;

  // Fixed per-particle direction on the sphere: sector centroids spread via a
  // fibonacci lattice, each stock jittered around its sector's centroid so
  // sectors read as clusters. Never changes after mount.
  const { dirs, sizeMul, geometry } = useMemo(() => {
    const centroids: THREE.Vector3[] = [];
    for (let s = 0; s < SECTORS.length; s++) {
      const y = 1 - (2 * (s + 0.5)) / SECTORS.length;
      const r = Math.sqrt(1 - y * y);
      const a = s * 2.399963; // golden angle
      centroids.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    const dirs = new Float32Array(count * 3);
    const sizeMul = new Float32Array(count);
    const shift = new Float32Array(count * 4);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const c = centroids[stocks[i].sector];
      v.set(
        c.x + (Math.random() - 0.5) * 1.15,
        c.y + (Math.random() - 0.5) * 1.15,
        c.z + (Math.random() - 0.5) * 1.15,
      ).normalize();
      dirs.set([v.x, v.y, v.z], i * 3);
      sizeMul[i] = Math.random() + 0.6; // 0.6..1.6, the demo's size scatter
      makeShift(shift, i, 0.07, 1.2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count).fill(3), 1));
    geometry.setAttribute("aShift", new THREE.BufferAttribute(shift, 4));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
    return { dirs, sizeMul, geometry };
    // sector assignment is fixed per index, so only count matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Decorative backdrop: a thin galaxy disc of dim warm-to-violet dust for
  // depth. Carries no data — kept far dimmer than the semantic core.
  const halo = useMemo(() => {
    const N = 900;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const shift = new Float32Array(N * 4);
    const inner = new THREE.Color(1.0, 0.62, 0.25).multiplyScalar(0.28);
    const outer = new THREE.Color(0.45, 0.3, 1.0).multiplyScalar(0.3);
    const tmp = new THREE.Color();
    const rIn = 1.35, rOut = 3.4;
    for (let i = 0; i < N; i++) {
      const rand = Math.pow(Math.random(), 1.5);
      const radius = Math.sqrt(rOut * rOut * rand + (1 - rand) * rIn * rIn);
      const a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * radius, (Math.random() - 0.5) * 0.28, Math.sin(a) * radius], i * 3);
      tmp.copy(inner).lerp(outer, (radius - rIn) / (rOut - rIn));
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
      size[i] = Math.random() + 0.8;
      makeShift(shift, i, 0.2, 0.5);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aShift", new THREE.BufferAttribute(shift, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5);
    return g;
  }, []);
  useEffect(() => () => halo.dispose(), [halo]);

  // Two clocks: the data tick writes targets here; the render loop below
  // eases current values toward them so updates read as continuous motion.
  const cur = useRef({
    radius: new Float32Array(count).fill(0.7),
    color: new Float32Array(count * 3),
    size: new Float32Array(count).fill(3),
  });
  const targets = useRef({
    radius: new Float32Array(count).fill(0.7),
    color: new Float32Array(count * 3),
    size: new Float32Array(count).fill(3),
  });

  useEffect(() => {
    const upC = new THREE.Color(UP_COLOR);
    const dnC = new THREE.Color(DN_COLOR);
    const neC = new THREE.Color(NEUTRAL_COLOR);
    const tmp = new THREE.Color();
    const t = targets.current;
    for (let i = 0; i < count; i++) {
      const ch = stocks[i].changePct;
      t.radius[i] = 0.55 + Math.min(Math.abs(ch), 8) * 0.09;
      const m = Math.pow(Math.min(Math.abs(ch) / 5, 1), 0.75);
      // big movers also glow hotter, not just greener/redder
      tmp.copy(neC).lerp(ch >= 0 ? upC : dnC, m).multiplyScalar(0.55 + 0.85 * m);
      t.color.set([tmp.r, tmp.g, tmp.b], i * 3);
      t.size[i] = (2.2 + stocks[i].relVolume * 1.8) * sizeMul[i];
    }
    if (reduced) {
      // no animation loop: snap to targets and render a single frame
      cur.current.radius.set(t.radius);
      cur.current.color.set(t.color);
      cur.current.size.set(t.size);
      invalidate();
    }
  }, [stocks, count, reduced, invalidate, sizeMul]);

  useFrame((state, delta) => {
    const c = cur.current;
    const t = targets.current;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const col = geometry.attributes.aColor as THREE.BufferAttribute;
    const size = geometry.attributes.aSize as THREE.BufferAttribute;
    const posA = pos.array as Float32Array;
    const k = reduced ? 1 : 1 - Math.exp(-delta * 2.2); // frame-rate independent ease

    for (let i = 0; i < count; i++) {
      c.radius[i] += (t.radius[i] - c.radius[i]) * k;
      c.size[i] += (t.size[i] - c.size[i]) * k;
      const i3 = i * 3;
      c.color[i3] += (t.color[i3] - c.color[i3]) * k;
      c.color[i3 + 1] += (t.color[i3 + 1] - c.color[i3 + 1]) * k;
      c.color[i3 + 2] += (t.color[i3 + 2] - c.color[i3 + 2]) * k;
      const r = c.radius[i];
      posA[i3] = dirs[i3] * r;
      posA[i3 + 1] = dirs[i3 + 1] * r;
      posA[i3 + 2] = dirs[i3 + 2] * r;
    }
    (col.array as Float32Array).set(c.color);
    (size.array as Float32Array).set(c.size);
    pos.needsUpdate = col.needsUpdate = size.needsUpdate = true;

    if (!reduced) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
      if (groupRef.current) groupRef.current.rotation.y += delta * 0.1;
      if (haloRef.current) haloRef.current.rotation.y -= delta * 0.04;
    }
  });

  return (
    <group ref={groupRef} rotation={[0, 0, 0.2]}>
      <points geometry={geometry} material={material} frustumCulled={false} />
      <points ref={haloRef} geometry={halo} material={material} frustumCulled={false} />
    </group>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function BreadthPanel() {
  // Sim + first snapshot are created client-side only (Math.random in render
  // would mismatch the server-prerendered HTML), so first paint shows "—".
  const simRef = useRef<ReturnType<typeof createBreadthSim> | null>(null);
  const [snapshot, setSnapshot] = useState<BreadthSnapshot | null>(null);
  const [webgl, setWebgl] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    simRef.current ??= createBreadthSim();
    setWebgl(webglAvailable());
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setSnapshot(simRef.current.tick());
    const id = setInterval(() => setSnapshot(simRef.current!.tick()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const up = snapshot && snapshot.advancers >= snapshot.decliners;

  return (
    <div className="breadth-panel">
      <div className="bp-head">
        <h3>
          Market breadth <span className="bp-tag">simulated</span>
        </h3>
        {snapshot && (
          <span className="bp-mood" style={{ color: up ? "var(--up)" : "var(--dn)" }}>
            {moodLabel(snapshot)}
          </span>
        )}
      </div>
      <div className="bp-canvas">
        {webgl && snapshot && (
          <Canvas
            camera={{ position: [0, 0, 2.3], fov: 42 }}
            dpr={[1, 2]}
            frameloop={reduced ? "demand" : "always"}
            gl={{ antialias: true, alpha: true }}
          >
            <ParticleCore stocks={snapshot.stocks} reduced={reduced} />
          </Canvas>
        )}
      </div>
      <div className="bp-chips">
        <div className="bp-chip">
          <span>Advancers</span>
          <b style={{ color: "var(--up)" }}>{snapshot ? fmt(snapshot.advancers) : "—"}</b>
        </div>
        <div className="bp-chip">
          <span>Decliners</span>
          <b style={{ color: "var(--dn)" }}>{snapshot ? fmt(snapshot.decliners) : "—"}</b>
        </div>
        <div className="bp-chip">
          <span>Up volume</span>
          <b>{snapshot ? `${snapshot.upVolumePct.toFixed(0)}%` : "—"}</b>
        </div>
      </div>
    </div>
  );
}
