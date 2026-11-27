import type { Event, Snapshot } from "@truman/contracts";
import { generateMap, insideCabin, WORLD_CONFIG, type WorldMap } from "@truman/world";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  interpolateWaypoints,
  TIMELINE_SAMPLE_MS,
  type CharacterPoseAnim,
  type TimelineState,
  type TimeOfDay,
} from "../state/timeline";
import { FireProps } from "./fireProps";
import { restPose } from "./restPose";
import {
  intersectsSceneryCorridor,
  sceneryCorridors,
  type SceneryFootprint,
} from "./sceneryClearance";

export type CameraMode = "follow" | "cabin" | "world";

const CABIN_FLOOR_HEIGHT = 0.16;
const RESOURCE_CANOPY_CLEARANCE = 1.95;
const HIDDEN_SCENERY = new THREE.Matrix4()
  .makeScale(0.00001, 0.00001, 0.00001)
  .setPosition(0, -1000, 0);

interface SceneryBatch {
  meshes: readonly THREE.InstancedMesh[];
  footprints: readonly SceneryFootprint[];
  hiddenTransforms: Map<number, THREE.Matrix4[]>;
}

interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  upperBody: THREE.Group;
  torso: THREE.Mesh;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftShin: THREE.Group;
  rightShin: THREE.Group;
  memorialGlow: THREE.PointLight;
}

const SKY_PRESETS: Record<
  TimeOfDay,
  {
    bg: number;
    fog: number;
    sunColor: number;
    sunIntensity: number;
    sunPos: [number, number, number];
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
  }
> = {
  dawn: {
    bg: 0x3b4d6b,
    fog: 0x52607c,
    sunColor: 0xffb37b,
    sunIntensity: 1.2,
    sunPos: [36, 16, -24],
    hemiSky: 0x9bb2d8,
    hemiGround: 0x39322c,
    hemiIntensity: 0.72,
  },
  day: {
    bg: 0x7faed4,
    fog: 0x95bad8,
    sunColor: 0xfff5dc,
    sunIntensity: 1.6,
    sunPos: [28, 44, 22],
    hemiSky: 0xd0e7ff,
    hemiGround: 0x45543b,
    hemiIntensity: 0.88,
  },
  dusk: {
    bg: 0x2f2d4c,
    fog: 0x433959,
    sunColor: 0xff8254,
    sunIntensity: 1.0,
    sunPos: [-32, 12, 24],
    hemiSky: 0x7a6592,
    hemiGround: 0x2a2422,
    hemiIntensity: 0.58,
  },
  night: {
    bg: 0x0b101d,
    fog: 0x111a2d,
    sunColor: 0x8ab0e6,
    sunIntensity: 0.38,
    sunPos: [-22, 32, -26],
    hemiSky: 0x24365c,
    hemiGround: 0x14171c,
    hemiIntensity: 0.38,
  },
};

function makeSeededRng(seed: number): () => number {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist2D(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

function distToPolyline(
  x: number,
  z: number,
  pts: ReadonlyArray<{ x: number; z: number }>,
): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2)) : 0;
    const d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
    if (d < best) best = d;
  }
  return best;
}

export class WorldScene {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly fog: THREE.FogExp2;
  private readonly worldGroup = new THREE.Group();
  private readonly character: CharacterRig;

  private readonly fireProps = new Map<string, FireProps>();
  private waterMeshes: THREE.Mesh[] = [];
  private precipPoints: THREE.Points | null = null;
  private precipKind: "none" | "rain" | "snow" = "none";

  private readonly sceneryBatches: SceneryBatch[] = [];
  private currentMap: WorldMap | null = null;
  private cameraMode: CameraMode = "follow";
  private latestState: TimelineState | null = null;
  private latestStateReceivedAt = 0;
  private playbackRate = 0;
  private rafId: number | null = null;
  private lastFrameMs = performance.now();
  private animClock = 0;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_PRESETS.day.bg);
    this.fog = new THREE.FogExp2(SKY_PRESETS.day.fog, 0.0042);
    this.scene.fog = this.fog;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 560);
    this.camera.position.set(6.4, 5.4, 6.8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 185;
    this.controls.target.set(0, 0.9, 0);

    this.hemiLight = new THREE.HemisphereLight(0xd0e7ff, 0x45543b, 0.88);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5dc, 1.6);
    this.sunLight.position.set(28, 44, 22);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 140;
    const d = 32;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    this.scene.add(this.worldGroup);

    this.character = this.buildCharacter();
    this.scene.add(this.character.root);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.startLoop();
  }

  applyFeedGeometry(snapshot: Snapshot, events: readonly Event[]): void {
    const { seed } = snapshot.world;
    if (this.currentMap?.seed !== seed) {
      this.currentMap = generateMap(seed);
      this.rebuildWorld(this.currentMap);
    }
    const corridors = sceneryCorridors(this.currentMap, snapshot, events);
    for (const { meshes, footprints, hiddenTransforms } of this.sceneryBatches) {
      footprints.forEach((footprint, index) => {
        const hidden = intersectsSceneryCorridor(footprint, corridors);
        const transforms = hiddenTransforms.get(index);
        if (hidden && !transforms) {
          hiddenTransforms.set(
            index,
            meshes.map((mesh) => {
              const original = new THREE.Matrix4();
              mesh.getMatrixAt(index, original);
              mesh.setMatrixAt(index, HIDDEN_SCENERY);
              mesh.instanceMatrix.needsUpdate = true;
              return original;
            }),
          );
        } else if (!hidden && transforms) {
          meshes.forEach((mesh, meshIndex) => {
            mesh.setMatrixAt(index, transforms[meshIndex]!);
            mesh.instanceMatrix.needsUpdate = true;
          });
          hiddenTransforms.delete(index);
        }
      });
    }
  }

  private registerScenery(footprints: SceneryFootprint[], ...meshes: THREE.InstancedMesh[]): void {
    // Keep the original instance bounds so restoring a hidden prop cannot clip it at the frustum.
    for (const mesh of meshes) mesh.computeBoundingSphere();
    this.sceneryBatches.push({ footprints, meshes, hiddenTransforms: new Map() });
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    if (mode === "cabin") {
      this.camera.position.set(6.4, 5.4, 6.8);
      this.controls.target.set(0, 0.9, 0);
    } else if (mode === "world") {
      this.camera.position.set(0, 62, 82);
      this.controls.target.set(0, 0, 0);
    } else if (mode === "follow" && this.latestState) {
      const p = this.latestState.pose;
      this.camera.position.set(p.x + 3.8, 3.4, p.z + 4.0);
      this.controls.target.set(p.x, 1.0, p.z);
    }
  }

  applyTimelineState(state: TimelineState, playbackRate: number): void {
    const isFirstState = this.latestState === null;
    this.latestState = state;
    this.latestStateReceivedAt = performance.now();
    this.playbackRate = playbackRate;
    if (isFirstState && this.cameraMode === "follow") {
      const p = state.pose;
      this.camera.position.set(p.x + 3.8, 3.4, p.z + 4.0);
      this.controls.target.set(p.x, 1.0, p.z);
    }
    this.applyAtmosphere(state.timeOfDay, state.weather);
    this.applyFireVisuals(state.fires);
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearFireProps();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private handleResize(): void {
    const w = Math.max(this.container.clientWidth, 240);
    const h = Math.max(this.container.clientHeight, 200);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private getFloorY(x: number, z: number): number {
    if (!this.currentMap) return 0;
    const hw = this.currentMap.cabin.halfW + 0.14;
    const hd = this.currentMap.cabin.halfD + 0.14;
    if (Math.abs(x) <= hw && Math.abs(z) <= hd) {
      return CABIN_FLOOR_HEIGHT;
    }
    if (insideCabin(this.currentMap, { x, z })) {
      return CABIN_FLOOR_HEIGHT;
    }
    return 0;
  }

  private rebuildWorld(map: WorldMap): void {
    this.clearFireProps();
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]!);
    }
    this.waterMeshes = [];
    this.sceneryBatches.length = 0;

    const rng = makeSeededRng(map.seed);

    // 1. Layered valley floor (flat y=0 inside walkable radius, gently rising foothills beyond)
    this.buildGround(map);

    // 2. Dirt footpaths connecting cabin door to key stations
    this.buildFootpaths(map);

    // 3. Cabin interior & cutaway walls
    this.buildCabin(map);

    // 4. Natural winding river with banks & shoreline stones
    this.buildRiver(map, rng);

    // 5. Organic mirror pool & natural spring
    this.buildMirrorPool(map, rng);
    this.buildSpring(map, rng);

    // 6. Resource nodes + varied low-poly trees, boulders, bushes & grass tufts
    this.buildResourceNodes(map, rng);
    this.buildValleyDetails(map, rng);

    // 7. Layered low-poly mountain ring encircling the valley
    this.buildMountainRing(map.radius, rng);
  }

  private buildGround(map: WorldMap): void {
    const outerRadius = map.radius + 95;
    const radialSegs = 28;
    const angularSegs = 72;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const baseMeadow = new THREE.Color(0x465e39);
    const warmClearing = new THREE.Color(0x576f42);
    const forestFloor = new THREE.Color(0x31492d);
    const dampBank = new THREE.Color(0x4b593c);
    const foothillRock = new THREE.Color(0x3e4738);
    const c = new THREE.Color();

    const forestCenter = map.stations.forest_edge;
    const clearingCenter = map.stations.clearing;

    // Center vertex
    positions.push(0, 0, 0);
    colors.push(baseMeadow.r, baseMeadow.g, baseMeadow.b);

    for (let rIdx = 1; rIdx <= radialSegs; rIdx++) {
      const t = rIdx / radialSegs;
      // Concentrate rings near walkable valley, stretch outer rings to foothills
      const r =
        t <= 0.78
          ? (t / 0.78) * map.radius
          : map.radius + ((t - 0.78) / 0.22) * (outerRadius - map.radius);

      for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
        const angle = (aIdx / angularSegs) * Math.PI * 2;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;

        // Strictly y = 0 inside walkable radius so the Resident never floats or clips
        let y = 0;
        if (r > map.radius) {
          const outT = (r - map.radius) / (outerRadius - map.radius);
          const ridgeWave = Math.sin(angle * 7 + map.seed) * 0.5 + Math.cos(angle * 13) * 0.5;
          y = outT * outT * (10 + ridgeWave * 3.5);
        }

        positions.push(x, y, z);

        // Organic layered ground tone blending
        c.copy(baseMeadow);
        const noise =
          Math.sin(x * 0.08 + map.seed * 0.3) * Math.cos(z * 0.08 - map.seed * 0.2) * 0.5 + 0.5;
        c.offsetHSL(0, (noise - 0.5) * 0.04, (noise - 0.5) * 0.05);

        const dClearing = dist2D(x, z, clearingCenter.x, clearingCenter.z);
        if (dClearing < 24) {
          c.lerp(warmClearing, (1 - dClearing / 24) * 0.6);
        }
        const dForest = dist2D(x, z, forestCenter.x, forestCenter.z);
        if (dForest < 34) {
          c.lerp(forestFloor, (1 - dForest / 34) * 0.65);
        }
        const dRiver = distToPolyline(x, z, map.river);
        if (dRiver < map.riverWidth + 8) {
          c.lerp(dampBank, (1 - dRiver / (map.riverWidth + 8)) * 0.5);
        }
        if (r > map.radius * 0.85) {
          const edgeT = Math.min(1, (r - map.radius * 0.85) / (map.radius * 0.3));
          c.lerp(foothillRock, edgeT * 0.65);
        }

        colors.push(c.r, c.g, c.b);
      }
    }

    // Center fan
    for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
      const next = (aIdx + 1) % angularSegs;
      indices.push(0, 1 + next, 1 + aIdx);
    }
    // Concentric quads
    for (let rIdx = 1; rIdx < radialSegs; rIdx++) {
      const rowA = 1 + (rIdx - 1) * angularSegs;
      const rowB = 1 + rIdx * angularSegs;
      for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
        const next = (aIdx + 1) % angularSegs;
        const a0 = rowA + aIdx;
        const a1 = rowA + next;
        const b0 = rowB + aIdx;
        const b1 = rowB + next;
        indices.push(a0, a1, b1, a0, b1, b0);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.02,
      flatShading: true,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.worldGroup.add(ground);
  }

  private buildRibbonGeometry(
    curve: THREE.CatmullRomCurve3,
    segments: number,
    widthFn: (t: number) => number,
    y: number,
    centerColor?: THREE.Color,
    edgeColor?: THREE.Color,
  ): THREE.BufferGeometry {
    const pts = curve.getSpacedPoints(segments);
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const hasColors = Boolean(centerColor && edgeColor);
    const useThreeVerts = hasColors;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = pts[i]!;
      const prev = pts[Math.max(0, i - 1)]!;
      const next = pts[Math.min(segments, i + 1)]!;
      const tx = next.x - prev.x;
      const tz = next.z - prev.z;
      const len = Math.hypot(tx, tz) || 1;
      // Perpendicular normal in XZ
      const nx = -tz / len;
      const nz = tx / len;
      const hw = widthFn(t) * 0.5;

      const lx = p.x - nx * hw;
      const lz = p.z - nz * hw;
      const rx = p.x + nx * hw;
      const rz = p.z + nz * hw;

      if (useThreeVerts && centerColor && edgeColor) {
        positions.push(lx, y, lz, p.x, y, p.z, rx, y, rz);
        colors.push(
          edgeColor.r,
          edgeColor.g,
          edgeColor.b,
          centerColor.r,
          centerColor.g,
          centerColor.b,
          edgeColor.r,
          edgeColor.g,
          edgeColor.b,
        );
      } else {
        positions.push(lx, y, lz, rx, y, rz);
      }
    }

    const stride = useThreeVerts ? 3 : 2;
    for (let i = 0; i < segments; i++) {
      const row = i * stride;
      const nextRow = (i + 1) * stride;
      if (useThreeVerts) {
        // Left half (CCW from +Y)
        indices.push(row, row + 1, nextRow, row + 1, nextRow + 1, nextRow);
        // Right half (CCW from +Y)
        indices.push(row + 1, row + 2, nextRow + 1, row + 2, nextRow + 2, nextRow + 1);
      } else {
        indices.push(row, row + 1, nextRow, row + 1, nextRow + 1, nextRow);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    if (hasColors) {
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    }
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private buildFootpaths(map: WorldMap): void {
    const pathMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
    });
    const pathCenter = new THREE.Color(0x7c6a50);
    const pathEdge = new THREE.Color(0x555d41);

    const wp = map.waypoints;
    const trails: Array<[string, string, string]> = [
      ["yard", "yard>forest_edge", "forest_edge"],
      ["yard", "yard>clearing", "clearing"],
      ["yard", "yard>river", "river"],
      ["yard", "yard>mirror_pool", "mirror_pool"],
      ["clearing", "clearing>spring", "spring"],
    ];

    for (const [aId, midId, bId] of trails) {
      const a = wp[aId];
      const mid = wp[midId];
      const b = wp[bId];
      if (!a || !mid || !b) continue;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(a.x, 0, a.z),
        new THREE.Vector3(mid.x, 0, mid.z),
        new THREE.Vector3(b.x, 0, b.z),
      ]);
      const geo = this.buildRibbonGeometry(
        curve,
        24,
        (t) => 1.05 + Math.sin(t * Math.PI) * 0.25,
        0.011,
        pathCenter,
        pathEdge,
      );
      const mesh = new THREE.Mesh(geo, pathMat);
      mesh.receiveShadow = true;
      this.worldGroup.add(mesh);
    }

    // Door-to-yard dirt apron
    const door = map.stations.door;
    const yard = wp.yard;
    if (door && yard) {
      const doorCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(door.x, 0, map.cabin.halfD + 0.15),
        new THREE.Vector3((door.x + yard.x) * 0.5, 0, (map.cabin.halfD + yard.z) * 0.5),
        new THREE.Vector3(yard.x, 0, yard.z),
      ]);
      const apronGeo = this.buildRibbonGeometry(
        doorCurve,
        10,
        (t) => 1.5 - t * 0.25,
        0.012,
        pathCenter,
        pathEdge,
      );
      const apron = new THREE.Mesh(apronGeo, pathMat);
      apron.receiveShadow = true;
      this.worldGroup.add(apron);
    }
  }

  private buildCabin(map: WorldMap): void {
    const hw = map.cabin.halfW;
    const hd = map.cabin.halfD;
    const cabinGroup = new THREE.Group();

    const woodDark = new THREE.MeshStandardMaterial({ color: 0x5a3e2b, roughness: 0.88 });
    const woodMid = new THREE.MeshStandardMaterial({ color: 0x6b4b34, roughness: 0.86 });
    const woodFloor = new THREE.MeshStandardMaterial({ color: 0x7c5a3e, roughness: 0.84 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x63676e, roughness: 0.92 });
    const fabricMat = new THREE.MeshStandardMaterial({ color: 0x586f8c, roughness: 0.85 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.9 });

    // Floor platform (top sits at y = CABIN_FLOOR_HEIGHT = 0.16)
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 2 + 0.3, CABIN_FLOOR_HEIGHT, hd * 2 + 0.3),
      woodFloor,
    );
    floor.position.set(0, CABIN_FLOOR_HEIGHT / 2, 0);
    floor.receiveShadow = true;
    cabinGroup.add(floor);

    // Stone doorstep outside the door
    const doorstep = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 0.55), stoneMat);
    doorstep.position.set(0, 0.05, hd + 0.38);
    doorstep.receiveShadow = true;
    cabinGroup.add(doorstep);

    // Back wall (with window gap) & left/right cutaway walls so spectators can see inside
    const wallH = 2.25;
    const wallT = 0.18;
    const backLeft = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.55, wallH, wallT), woodDark);
    backLeft.position.set(-(hw + 0.55) / 2, wallH / 2 + 0.12, -hd);
    backLeft.castShadow = true;
    backLeft.receiveShadow = true;
    cabinGroup.add(backLeft);

    const backRight = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.55, wallH, wallT), woodDark);
    backRight.position.set((hw + 0.55) / 2, wallH / 2 + 0.12, -hd);
    backRight.castShadow = true;
    backRight.receiveShadow = true;
    cabinGroup.add(backRight);

    // Window sill & header
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, wallT), woodDark);
    sill.position.set(0, 0.55, -hd);
    cabinGroup.add(sill);

    const header = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.44, wallT), woodDark);
    header.position.set(0, 2.15, -hd);
    cabinGroup.add(header);

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.95),
      new THREE.MeshStandardMaterial({
        color: 0x9ec5e6,
        transparent: true,
        opacity: 0.35,
        roughness: 0.15,
        side: THREE.DoubleSide,
      }),
    );
    glass.position.set(0, 1.45, -hd);
    cabinGroup.add(glass);

    // Left wall (full) and right wall (low cutaway for camera sightlines)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, hd * 2), woodDark);
    leftWall.position.set(-hw, wallH / 2 + 0.12, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    cabinGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, 0.72, hd * 2), woodDark);
    rightWall.position.set(hw, 0.48, 0);
    rightWall.receiveShadow = true;
    cabinGroup.add(rightWall);

    // Door threshold markers at front (z = +hd)
    const doorPostL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 0.18), woodDark);
    doorPostL.position.set(-0.6, 1.15, hd);
    cabinGroup.add(doorPostL);
    const doorPostR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 0.18), woodDark);
    doorPostR.position.set(0.6, 1.15, hd);
    cabinGroup.add(doorPostR);

    // Bed at stations.bed
    const bedPos = map.stations.bed;
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.36, 1.65), woodDark);
    bedFrame.position.set(bedPos.x, 0.34, bedPos.z);
    bedFrame.castShadow = true;
    bedFrame.receiveShadow = true;
    cabinGroup.add(bedFrame);

    const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.12, 1.2), fabricMat);
    blanket.position.set(bedPos.x, 0.56, bedPos.z + 0.18);
    cabinGroup.add(blanket);

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.32), pillowMat);
    pillow.position.set(bedPos.x, 0.58, bedPos.z - 0.56);
    cabinGroup.add(pillow);

    // Desk & glowing terminal at stations.desk (with grounded legs)
    const deskPos = map.stations.desk;
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.65), woodMid);
    deskTop.position.set(deskPos.x, 0.82, deskPos.z);
    deskTop.castShadow = true;
    cabinGroup.add(deskTop);

    for (const lx of [-0.5, 0.5]) {
      for (const lz of [-0.26, 0.26]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.64, 0.07), woodDark);
        leg.position.set(deskPos.x + lx, CABIN_FLOOR_HEIGHT + 0.32, deskPos.z + lz);
        cabinGroup.add(leg);
      }
    }

    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.34, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x262a33, roughness: 0.6 }),
    );
    monitor.position.set(deskPos.x, 1.06, deskPos.z - 0.14);
    cabinGroup.add(monitor);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.24),
      new THREE.MeshStandardMaterial({
        color: 0x7ef2c8,
        emissive: 0x35b58d,
        emissiveIntensity: 0.75,
      }),
    );
    screen.position.set(deskPos.x, 1.06, deskPos.z - 0.075);
    cabinGroup.add(screen);

    // Journal table at stations.journal_table
    const jtPos = map.stations.journal_table;
    const jt = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.68, 0.58), woodDark);
    jt.position.set(jtPos.x, CABIN_FLOOR_HEIGHT + 0.34, jtPos.z);
    jt.castShadow = true;
    cabinGroup.add(jt);

    const notebook = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.24), pillowMat);
    notebook.position.set(jtPos.x, CABIN_FLOOR_HEIGHT + 0.7, jtPos.z);
    cabinGroup.add(notebook);

    // Hearth / stove at map.hearth
    const hPos = map.hearth;
    const hearthBase = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.42, 8), stoneMat);
    hearthBase.position.set(hPos.x, CABIN_FLOOR_HEIGHT + 0.21, hPos.z);
    hearthBase.castShadow = true;
    cabinGroup.add(hearthBase);

    this.worldGroup.add(cabinGroup);
  }

  private buildRiver(map: WorldMap, rng: () => number): void {
    if (map.river.length < 2) return;

    // Extend river smoothly past both ends to reach the mountain foothills
    const pts = map.river.map((p) => new THREE.Vector3(p.x, 0, p.z));
    const first = pts[0]!;
    const second = pts[1]!;
    const startDir = first.clone().sub(second).normalize();
    const last = pts[pts.length - 1]!;
    const prevLast = pts[pts.length - 2]!;
    const endDir = last.clone().sub(prevLast).normalize();

    const extendedPts = [
      first.clone().addScaledVector(startDir, 45),
      first.clone().addScaledVector(startDir, 20),
      ...pts,
      last.clone().addScaledVector(endDir, 20),
      last.clone().addScaledVector(endDir, 45),
    ];

    const curve = new THREE.CatmullRomCurve3(extendedPts, false, "catmullrom", 0.5);
    const segs = 76;

    // 1. Outer sandy/pebble bank ribbon
    const bankGeo = this.buildRibbonGeometry(
      curve,
      segs,
      (t) => map.riverWidth + 2.8 + Math.sin(t * Math.PI * 6) * 0.55,
      0.009,
      new THREE.Color(0x8a795c),
      new THREE.Color(0x555e3f),
    );
    const bankMesh = new THREE.Mesh(
      bankGeo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.94,
        metalness: 0.02,
      }),
    );
    bankMesh.receiveShadow = true;
    this.worldGroup.add(bankMesh);

    // 2. Smooth winding water surface with deeper center channel & lighter edges
    const waterGeo = this.buildRibbonGeometry(
      curve,
      segs,
      (t) => map.riverWidth * (0.94 + Math.sin(t * Math.PI * 5 + 0.6) * 0.1),
      0.028,
      new THREE.Color(0x21587a),
      new THREE.Color(0x4f95b8),
    );
    const waterMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.14,
      metalness: 0.42,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.receiveShadow = true;
    this.worldGroup.add(waterMesh);
    this.waterMeshes.push(waterMesh);

    // 3. Instanced shoreline pebbles & boulders along both banks
    const rockCount = 68;
    const rockGeo = new THREE.DodecahedronGeometry(0.45, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x767a7e,
      roughness: 0.9,
      flatShading: true,
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    const dummy = new THREE.Object3D();
    const rockColor = new THREE.Color();
    const riverStation = map.stations.river;
    const footprints: SceneryFootprint[] = [];
    let placed = 0;

    for (let i = 0; i < rockCount * 2 && placed < rockCount; i++) {
      const t = 0.08 + rng() * 0.84;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      const off = map.riverWidth * 0.52 + 0.25 + rng() * 1.1;
      const rx = p.x + -tan.z * side * off;
      const rz = p.z + tan.x * side * off;

      if (Math.hypot(rx, rz) > map.radius - 4) continue;
      if (dist2D(rx, rz, riverStation.x, riverStation.z) < 2.6) continue;

      const s = 0.45 + rng() * 1.05;
      dummy.position.set(rx, s * 0.18, rz);
      dummy.rotation.set(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.5);
      dummy.scale.set(s * (0.9 + rng() * 0.4), s * 0.55, s * (0.85 + rng() * 0.35));
      dummy.updateMatrix();
      rocks.setMatrixAt(placed, dummy.matrix);
      footprints.push({ x: rx, z: rz, radius: 0.45 * Math.max(dummy.scale.x, dummy.scale.z) });

      rockColor.setHex(rng() > 0.4 ? 0x74797d : 0x8b8476);
      rockColor.offsetHSL(0, 0, (rng() - 0.5) * 0.08);
      rocks.setColorAt(placed, rockColor);
      placed++;
    }
    rocks.count = placed;
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    this.worldGroup.add(rocks);
    this.registerScenery(footprints, rocks);
  }

  private buildOrganicDiscGeometry(
    radius: number,
    segments: number,
    seed: number,
    y: number,
    centerColor: THREE.Color,
    edgeColor: THREE.Color,
  ): THREE.BufferGeometry {
    const positions: number[] = [0, y, 0];
    const colors: number[] = [centerColor.r, centerColor.g, centerColor.b];
    const indices: number[] = [];

    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const wobble =
        1 +
        Math.sin(a * 3 + seed) * 0.08 +
        Math.cos(a * 5 - seed * 1.7) * 0.05 +
        Math.sin(a * 2 + seed * 0.5) * 0.06;
      const r = radius * wobble;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      colors.push(edgeColor.r, edgeColor.g, edgeColor.b);
    }

    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      indices.push(0, 1 + next, 1 + i);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private buildMirrorPool(map: WorldMap, rng: () => number): void {
    const { x, z, radius } = map.pool;
    const poolGroup = new THREE.Group();
    poolGroup.position.set(x, 0, z);

    // Outer pebble/sand rim
    const shoreGeo = this.buildOrganicDiscGeometry(
      radius * 1.24,
      28,
      map.seed + 11,
      0.01,
      new THREE.Color(0x887c66),
      new THREE.Color(0x525d40),
    );
    const shore = new THREE.Mesh(
      shoreGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }),
    );
    shore.receiveShadow = true;
    poolGroup.add(shore);

    // Reflective mirror water surface
    const waterGeo = this.buildOrganicDiscGeometry(
      radius * 1.0,
      28,
      map.seed + 11,
      0.032,
      new THREE.Color(0x2c6082),
      new THREE.Color(0x69a4c4),
    );
    const waterMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.78,
      roughness: 0.08,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.receiveShadow = true;
    poolGroup.add(water);
    this.waterMeshes.push(water);

    // Natural stone rim leaving a clear approach at stations.mirror_pool
    const stationAngle = Math.atan2(map.stations.mirror_pool.z - z, map.stations.mirror_pool.x - x);
    const stoneCount = 26;
    const stoneGeo = new THREE.DodecahedronGeometry(0.55, 0);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x70767b,
      roughness: 0.88,
      flatShading: true,
    });
    const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, stoneCount);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const footprints: SceneryFootprint[] = [];
    let placed = 0;

    for (let i = 0; i < stoneCount; i++) {
      const a = (i / stoneCount) * Math.PI * 2 + (rng() - 0.5) * 0.12;
      let diff = a - stationAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.42) continue;

      const wobble =
        1 +
        Math.sin(a * 3 + map.seed + 11) * 0.08 +
        Math.cos(a * 5 - (map.seed + 11) * 1.7) * 0.05 +
        Math.sin(a * 2 + (map.seed + 11) * 0.5) * 0.06;
      const r = radius * wobble * (1.03 + rng() * 0.09);
      const sx = 0.75 + rng() * 0.85;
      const sy = 0.45 + rng() * 0.45;
      const sz = 0.7 + rng() * 0.75;

      dummy.position.set(Math.cos(a) * r, sy * 0.25, Math.sin(a) * r);
      dummy.rotation.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.4);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      stones.setMatrixAt(placed, dummy.matrix);
      footprints.push({
        x: x + dummy.position.x,
        z: z + dummy.position.z,
        radius: 0.55 * Math.max(sx, sy, sz),
      });

      col.setHex(rng() > 0.35 ? 0x6f757b : 0x5c6b5a);
      stones.setColorAt(placed, col);
      placed++;
    }
    stones.count = placed;
    stones.castShadow = true;
    stones.receiveShadow = true;
    poolGroup.add(stones);
    this.registerScenery(footprints, stones);

    this.worldGroup.add(poolGroup);
  }

  private buildSpring(map: WorldMap, rng: () => number): void {
    const springGroup = new THREE.Group();
    springGroup.position.set(map.spring.x, 0, map.spring.z);

    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.35, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b7075, roughness: 0.9, flatShading: true }),
    );
    basin.position.y = 0.05;
    basin.receiveShadow = true;
    springGroup.add(basin);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(0.96, 12),
      new THREE.MeshStandardMaterial({ color: 0x62b4d9, roughness: 0.15, metalness: 0.45 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.125;
    springGroup.add(water);
    this.waterMeshes.push(water);

    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0x7b8085,
      roughness: 0.9,
      flatShading: true,
    });
    const pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
    const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, 7);
    const dummy = new THREE.Object3D();
    const footprints: SceneryFootprint[] = [];
    for (let i = 0; i < pebbles.count; i++) {
      const a = (i / 7) * Math.PI * 2 + rng() * 0.4;
      const radius = 0.24 + rng() * 0.14;
      dummy.position.set(Math.cos(a) * 1.15, 0.12, Math.sin(a) * 1.15);
      dummy.scale.set(radius, radius * 0.65, radius);
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
      footprints.push({
        x: map.spring.x + dummy.position.x,
        z: map.spring.z + dummy.position.z,
        radius,
      });
    }
    springGroup.add(pebbles);
    this.registerScenery(footprints, pebbles);

    this.worldGroup.add(springGroup);
  }

  private buildResourceNodes(map: WorldMap, rng: () => number): void {
    const conifers = map.nodes.filter((n) => n.kind === "tree");
    const fruitTrees = map.nodes.filter((n) => n.kind === "fruit_tree");
    const bushes = map.nodes.filter(
      (n) => n.kind === "berry_bush" || n.kind === "herb_patch" || n.kind === "root_patch",
    );
    const woodpiles = map.nodes.filter((n) => n.kind === "woodpile" || n.kind === "deadwood");
    const rocks = map.nodes.filter((n) => n.kind === "stone_outcrop" || n.kind === "flint_nodule");
    const reeds = map.nodes.filter((n) => n.kind === "reed_bed");
    const clayBanks = map.nodes.filter((n) => n.kind === "clay_bank");
    const mushrooms = map.nodes.filter((n) => n.kind === "mushroom_patch");
    const fishShoals = map.nodes.filter((n) => n.kind === "fish_shoal");

    // Multi-tiered low-poly conifers
    this.addConiferInstances(conifers, rng, 0.9, 1.35);

    // Deciduous fruit trees
    if (fruitTrees.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.24, 1.8, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3f2a, roughness: 0.9 });
      const crownGeo = new THREE.DodecahedronGeometry(1.15, 0);
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0x457339,
        roughness: 0.88,
        flatShading: true,
      });
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, fruitTrees.length);
      const crowns = new THREE.InstancedMesh(crownGeo, crownMat, fruitTrees.length);
      trunks.castShadow = true;
      crowns.castShadow = true;

      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      fruitTrees.forEach((t, i) => {
        const s = 0.9 + rng() * 0.35;
        const canopyLift = Math.max(0, RESOURCE_CANOPY_CLEARANCE - (2.4 - 1.15 * 0.92) * s);
        dummy.position.set(t.x, 0.9 * s + canopyLift * 0.5, t.z);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.scale.set(s, s + canopyLift / 1.8, s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, 2.4 * s + canopyLift, t.z);
        dummy.scale.set(s * 1.08, s * 0.92, s * 1.08);
        dummy.updateMatrix();
        crowns.setMatrixAt(i, dummy.matrix);

        col.setHex(0x4b783c).offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.08);
        crowns.setColorAt(i, col);
      });
      this.worldGroup.add(trunks, crowns);
    }

    // Bushes / herbs / roots
    if (bushes.length > 0) {
      const bushGeo = new THREE.DodecahedronGeometry(0.46, 0);
      const bushMat = new THREE.MeshStandardMaterial({
        color: 0x3f6e3a,
        roughness: 0.9,
        flatShading: true,
      });
      const inst = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      bushes.forEach((b, i) => {
        const s = b.kind === "berry_bush" ? 0.95 + rng() * 0.35 : 0.65 + rng() * 0.25;
        dummy.position.set(b.x, 0.28 * s, b.z);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.scale.set(s * 1.15, s * 0.72, s * 1.05);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);

        col.setHex(
          b.kind === "berry_bush" ? 0x356235 : b.kind === "herb_patch" ? 0x528246 : 0x62733e,
        );
        inst.setColorAt(i, col);
      });
      inst.castShadow = true;
      this.worldGroup.add(inst);
    }

    // Stone outcrops & flint
    if (rocks.length > 0) {
      const rockGeo = new THREE.DodecahedronGeometry(0.65, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x72777d,
        roughness: 0.92,
        flatShading: true,
      });
      const inst = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
      const dummy = new THREE.Object3D();
      rocks.forEach((r, i) => {
        const s = r.kind === "stone_outcrop" ? 0.9 + rng() * 0.5 : 0.55 + rng() * 0.25;
        dummy.position.set(r.x, 0.32 * s, r.z);
        dummy.rotation.set(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.5);
        dummy.scale.set(s * 1.2, s * 0.68, s);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      this.worldGroup.add(inst);
    }

    // Reed beds along the river
    if (reeds.length > 0) {
      const reedGeo = new THREE.CylinderGeometry(0.03, 0.045, 1.15, 5);
      const reedMat = new THREE.MeshStandardMaterial({ color: 0x597841, roughness: 0.9 });
      const stalksPerBed = 6;
      const inst = new THREE.InstancedMesh(reedGeo, reedMat, reeds.length * stalksPerBed);
      const dummy = new THREE.Object3D();
      let idx = 0;
      for (const r of reeds) {
        for (let k = 0; k < stalksPerBed; k++) {
          const a = (k / stalksPerBed) * Math.PI * 2 + rng() * 0.5;
          const rad = 0.1 + rng() * 0.45;
          const h = 0.75 + rng() * 0.55;
          dummy.position.set(r.x + Math.cos(a) * rad, 0.55 * h, r.z + Math.sin(a) * rad);
          dummy.rotation.set((rng() - 0.5) * 0.25, rng() * Math.PI, (rng() - 0.5) * 0.25);
          dummy.scale.set(1, h, 1);
          dummy.updateMatrix();
          inst.setMatrixAt(idx++, dummy.matrix);
        }
      }
      this.worldGroup.add(inst);
    }

    // Clay banks
    for (const cb of clayBanks) {
      const mound = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.8, 0),
        new THREE.MeshStandardMaterial({ color: 0x996d4f, roughness: 0.94, flatShading: true }),
      );
      mound.position.set(cb.x, 0.18, cb.z);
      mound.scale.set(1.4, 0.35, 1.1);
      this.worldGroup.add(mound);
    }

    // Mushroom patches
    if (mushrooms.length > 0) {
      const capMat = new THREE.MeshStandardMaterial({ color: 0xc29c72, roughness: 0.85 });
      const stemMat = new THREE.MeshStandardMaterial({ color: 0xe2d8c5, roughness: 0.9 });
      for (const m of mushrooms) {
        for (let k = 0; k < 3; k++) {
          const ox = (rng() - 0.5) * 0.6;
          const oz = (rng() - 0.5) * 0.6;
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 5), stemMat);
          stem.position.set(m.x + ox, 0.08, m.z + oz);
          const cap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.09, 6), capMat);
          cap.position.set(m.x + ox, 0.18, m.z + oz);
          this.worldGroup.add(stem, cap);
        }
      }
    }

    // Fish shoals
    if (fishShoals.length > 0) {
      const fishMat = new THREE.MeshStandardMaterial({
        color: 0x9ab8c9,
        roughness: 0.3,
        metalness: 0.5,
      });
      for (const fs of fishShoals) {
        for (let k = 0; k < 4; k++) {
          const fish = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), fishMat);
          fish.rotation.x = Math.PI / 2;
          fish.rotation.z = rng() * Math.PI * 2;
          fish.position.set(fs.x + (rng() - 0.5) * 1.1, 0.04, fs.z + (rng() - 0.5) * 1.1);
          this.worldGroup.add(fish);
        }
      }
    }

    // Woodpiles & deadwood
    const logMat = new THREE.MeshStandardMaterial({ color: 0x6b472d, roughness: 0.92 });
    for (const wp of woodpiles) {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.68, 6), logMat);
        log.rotation.z = Math.PI / 2;
        log.position.set(0, 0.085 + (i === 2 ? 0.13 : 0), (i - 1) * 0.15);
        g.add(log);
      }
      const yBase = this.getFloorY(wp.x, wp.z);
      g.position.set(wp.x, yBase, wp.z);
      this.worldGroup.add(g);
    }
  }

  private addConiferInstances(
    positions: ReadonlyArray<{ x: number; z: number }>,
    rng: () => number,
    minScale: number,
    maxScale: number,
    decorative = false,
  ): void {
    if (positions.length === 0) return;

    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 1.9, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x523926, roughness: 0.92 });
    const tier1Geo = new THREE.ConeGeometry(1.45, 2.1, 6);
    const tier2Geo = new THREE.ConeGeometry(1.12, 1.9, 6);
    const tier3Geo = new THREE.ConeGeometry(0.72, 1.5, 6);
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      flatShading: true,
    });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length);
    const tier1 = new THREE.InstancedMesh(tier1Geo, foliageMat, positions.length);
    const tier2 = new THREE.InstancedMesh(tier2Geo, foliageMat, positions.length);
    const tier3 = new THREE.InstancedMesh(tier3Geo, foliageMat, positions.length);

    trunks.castShadow = true;
    tier1.castShadow = true;
    tier2.castShadow = true;
    tier3.castShadow = true;

    const greens = [0x264e2e, 0x2e5b34, 0x356438, 0x22462a, 0x3d6b3b];
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const footprints: SceneryFootprint[] = [];

    positions.forEach((p, i) => {
      const s = minScale + rng() * (maxScale - minScale);
      const hStretch = 0.9 + rng() * 0.35;
      const canopyLift = decorative
        ? 0
        : Math.max(0, RESOURCE_CANOPY_CLEARANCE - (2.05 - 0.85 * hStretch) * s);
      const rotY = rng() * Math.PI * 2;
      const shade = greens[Math.floor(rng() * greens.length)] ?? 0x2e5b34;

      dummy.rotation.set(0, rotY, 0);

      dummy.position.set(p.x, 0.95 * s + canopyLift * 0.5, p.z);
      dummy.scale.set(s, s + canopyLift / 1.9, s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, (2.05 + 0.2 * hStretch) * s + canopyLift, p.z);
      dummy.scale.set(s, s * hStretch, s);
      dummy.updateMatrix();
      tier1.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, (3.15 + 0.45 * hStretch) * s + canopyLift, p.z);
      dummy.rotation.y = rotY + 0.45;
      dummy.updateMatrix();
      tier2.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, (4.15 + 0.65 * hStretch) * s + canopyLift, p.z);
      dummy.rotation.y = rotY + 0.9;
      dummy.updateMatrix();
      tier3.setMatrixAt(i, dummy.matrix);

      col.setHex(shade);
      tier1.setColorAt(i, col);
      col.offsetHSL(0, 0, 0.03);
      tier2.setColorAt(i, col);
      col.offsetHSL(0, 0, 0.03);
      tier3.setColorAt(i, col);
      if (decorative) footprints.push({ ...p, radius: 1.45 * s });
    });

    this.worldGroup.add(trunks, tier1, tier2, tier3);
    if (decorative) this.registerScenery(footprints, trunks, tier1, tier2, tier3);
  }

  private buildValleyDetails(map: WorldMap, rng: () => number): void {
    const isClear = (x: number, z: number, minPad: number): boolean => {
      const r = Math.hypot(x, z);
      if (r > map.radius - 4) return false;
      if (
        Math.abs(x) < map.cabin.halfW + 5 + minPad &&
        Math.abs(z) < map.cabin.halfD + 5 + minPad
      ) {
        return false;
      }
      if (dist2D(x, z, map.pool.x, map.pool.z) < map.pool.radius + 3.5 + minPad) return false;
      if (dist2D(x, z, map.spring.x, map.spring.z) < 3.5 + minPad) return false;
      if (distToPolyline(x, z, map.river) < map.riverWidth * 0.5 + 3.5 + minPad) return false;
      for (const st of Object.values(map.stations)) {
        if (dist2D(x, z, st.x, st.z) < 3.8 + minPad) return false;
      }
      for (const wp of Object.values(map.waypoints)) {
        if (dist2D(x, z, wp.x, wp.z) < 2.6 + minPad) return false;
      }
      return true;
    };

    // 1. Scenic background pine groves around the outer valley so the landscape feels rich
    const outerTrees: Array<{ x: number; z: number }> = [];
    for (let attempt = 0; attempt < 420 && outerTrees.length < 130; attempt++) {
      const a = rng() * Math.PI * 2;
      const r = 34 + Math.pow(rng(), 0.72) * (map.radius - 40);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!isClear(x, z, 2.2)) continue;
      let tooClose = false;
      for (const t of outerTrees) {
        if (dist2D(x, z, t.x, t.z) < 4.5) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) outerTrees.push({ x, z });
    }
    this.addConiferInstances(outerTrees, rng, 1.0, 1.65, true);

    // 2. Scattered valley boulders
    const boulderCount = 48;
    const boulderGeo = new THREE.DodecahedronGeometry(0.75, 0);
    const boulderMat = new THREE.MeshStandardMaterial({
      color: 0x70757a,
      roughness: 0.92,
      flatShading: true,
    });
    const boulders = new THREE.InstancedMesh(boulderGeo, boulderMat, boulderCount);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const footprints: SceneryFootprint[] = [];
    let placed = 0;
    for (let attempt = 0; attempt < 180 && placed < boulderCount; attempt++) {
      const a = rng() * Math.PI * 2;
      const r = 12 + rng() * (map.radius - 18);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!isClear(x, z, 1.5)) continue;
      const s = 0.55 + rng() * 1.25;
      dummy.position.set(x, s * 0.25, z);
      dummy.rotation.set(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6);
      dummy.scale.set(s * (0.9 + rng() * 0.4), s * 0.62, s * (0.85 + rng() * 0.4));
      dummy.updateMatrix();
      boulders.setMatrixAt(placed, dummy.matrix);
      footprints.push({ x, z, radius: 0.75 * Math.max(dummy.scale.x, dummy.scale.z) });
      col.setHex(rng() > 0.4 ? 0x6d7379 : 0x7b786e);
      boulders.setColorAt(placed, col);
      placed++;
    }
    boulders.count = placed;
    boulders.castShadow = true;
    boulders.receiveShadow = true;
    this.worldGroup.add(boulders);
    this.registerScenery(footprints, boulders);

    // 3. Instanced low-poly grass tufts
    const tuftCount = 240;
    const tuftGeo = new THREE.ConeGeometry(0.22, 0.42, 4);
    const tuftMat = new THREE.MeshStandardMaterial({
      color: 0x4b7039,
      roughness: 0.94,
      flatShading: true,
    });
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
    let tPlaced = 0;
    for (let attempt = 0; attempt < 500 && tPlaced < tuftCount; attempt++) {
      const a = rng() * Math.PI * 2;
      const r = 6 + Math.sqrt(rng()) * (map.radius - 12);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!isClear(x, z, 0.2)) continue;
      const s = 0.65 + rng() * 0.85;
      dummy.position.set(x, 0.18 * s, z);
      dummy.rotation.set((rng() - 0.5) * 0.25, rng() * Math.PI * 2, (rng() - 0.5) * 0.25);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      tufts.setMatrixAt(tPlaced, dummy.matrix);
      col.setHex(0x4c713a).offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.08);
      tufts.setColorAt(tPlaced, col);
      tPlaced++;
    }
    tufts.count = tPlaced;
    this.worldGroup.add(tufts);
  }

  private buildMountainRing(radius: number, rng: () => number): void {
    // Helper to create a faceted low-poly mountain cone with rock-to-snow vertex colors
    const makePeakGeometry = (snowThreshold: number, baseHex: number, peakHex: number) => {
      const geo = new THREE.ConeGeometry(1, 1, 7, 3, false);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      const baseCol = new THREE.Color(baseHex);
      const midCol = new THREE.Color(0x5d646d);
      const snowCol = new THREE.Color(peakHex);
      const tmp = new THREE.Color();

      for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i);
        const vy = pos.getY(i); // -0.5 to +0.5
        let vz = pos.getZ(i);
        const hNorm = vy + 0.5; // 0 at base, 1 at peak

        // Subtle deterministic angular cragginess on mid slopes
        if (hNorm > 0.05 && hNorm < 0.95) {
          const angle = Math.atan2(vz, vx);
          const crag = 1 + Math.sin(angle * 3 + vy * 5) * 0.14 + Math.cos(angle * 5) * 0.08;
          vx *= crag;
          vz *= crag;
          pos.setXYZ(i, vx, vy, vz);
        }

        if (hNorm < 0.35) {
          tmp.copy(baseCol).lerp(midCol, hNorm / 0.35);
        } else if (hNorm < snowThreshold) {
          tmp.copy(midCol);
        } else {
          const sT = Math.min(1, (hNorm - snowThreshold) / (1 - snowThreshold));
          tmp.copy(midCol).lerp(snowCol, sT);
        }
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }

      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const nonIndexed = geo.toNonIndexed();
      nonIndexed.computeVertexNormals();
      geo.dispose();
      return nonIndexed;
    };

    const mountainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.93,
      metalness: 0.03,
      flatShading: true,
    });

    const addRing = (
      count: number,
      minR: number,
      maxR: number,
      minH: number,
      maxH: number,
      minW: number,
      maxW: number,
      geo: THREE.BufferGeometry,
    ) => {
      const inst = new THREE.InstancedMesh(geo, mountainMat, count);
      const dummy = new THREE.Object3D();
      const footprints: SceneryFootprint[] = [];
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + (rng() - 0.5) * (Math.PI / count);
        const r = minR + rng() * (maxR - minR);
        const h = minH + rng() * (maxH - minH);
        const w = minW + rng() * (maxW - minW);
        dummy.position.set(Math.cos(a) * r, h * 0.45 - 1.5, Math.sin(a) * r);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.scale.set(w, h, w * (0.85 + rng() * 0.3));
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        footprints.push({
          x: dummy.position.x,
          z: dummy.position.z,
          radius: Math.max(dummy.scale.x, dummy.scale.z) * 1.24,
        });
      }
      inst.receiveShadow = true;
      this.worldGroup.add(inst);
      this.registerScenery(footprints, inst);
    };

    // Layer 1: Inner wooded foothills
    const foothillGeo = makePeakGeometry(0.95, 0x344932, 0x6f757b);
    addRing(52, radius + 6, radius + 22, 16, 30, 18, 30, foothillGeo);

    // Layer 2: Mid rocky ridge
    const midRidgeGeo = makePeakGeometry(0.76, 0x46514a, 0xcbd5df);
    addRing(46, radius + 24, radius + 46, 34, 58, 26, 42, midRidgeGeo);

    // Layer 3: High alpine peaks with snow caps
    const highPeakGeo = makePeakGeometry(0.64, 0x4c545e, 0xe5edf5);
    addRing(36, radius + 48, radius + 76, 56, 92, 34, 56, highPeakGeo);
  }

  private buildCharacter(): CharacterRig {
    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // Strictly gender-neutral, earthy low-poly traveler palette
    const tunicMat = new THREE.MeshStandardMaterial({
      color: 0xb88b5a,
      roughness: 0.8,
      flatShading: true,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x7a5b3b,
      roughness: 0.85,
      flatShading: true,
    });
    const beltMat = new THREE.MeshStandardMaterial({
      color: 0x463222,
      roughness: 0.85,
      flatShading: true,
    });
    const buckleMat = new THREE.MeshStandardMaterial({
      color: 0xc4a464,
      roughness: 0.45,
      metalness: 0.5,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x3b4857,
      roughness: 0.86,
      flatShading: true,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x3d2a1d,
      roughness: 0.88,
      flatShading: true,
    });
    const soleMat = new THREE.MeshStandardMaterial({
      color: 0x241911,
      roughness: 0.94,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xdfbda0,
      roughness: 0.72,
      flatShading: true,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.86,
      flatShading: true,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x24201d,
      roughness: 0.5,
    });

    // Exact leg geometry: hip pivot at y = 0.78, thigh 0.34, shin+boot 0.44 => boot sole bottom = 0.000
    const makeLeg = (xPos: number): { hip: THREE.Group; shin: THREE.Group } => {
      const hip = new THREE.Group();
      hip.position.set(xPos, 0.78, 0);

      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.075, 0.34, 6), pantsMat);
      thigh.position.y = -0.17;
      thigh.castShadow = true;
      hip.add(thigh);

      const shin = new THREE.Group();
      shin.position.set(0, -0.34, 0);
      hip.add(shin);

      const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.34, 6), pantsMat);
      calf.position.y = -0.17;
      calf.castShadow = true;
      shin.add(calf);

      // Boot cuff
      const bootCuff = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.1, 0.145), bootMat);
      bootCuff.position.set(0, -0.33, 0.005);
      bootCuff.castShadow = true;
      shin.add(bootCuff);

      // Boot foot (height 0.08, centered at -0.38 => bottom at -0.42)
      const bootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.22), bootMat);
      bootFoot.position.set(0, -0.38, 0.038);
      bootFoot.castShadow = true;
      shin.add(bootFoot);

      // Boot sole (height 0.02, centered at -0.43 => bottom at -0.44 => exact y = 0.000)
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.146, 0.02, 0.23), soleMat);
      sole.position.set(0, -0.43, 0.038);
      shin.add(sole);

      return { hip, shin };
    };

    const leftLegRig = makeLeg(-0.115);
    const rightLegRig = makeLeg(0.115);
    bodyGroup.add(leftLegRig.hip, rightLegRig.hip);

    // Lower tunic hem / pelvis cap
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.235, 0.17, 6), tunicMat);
    hem.position.y = 0.77;
    hem.scale.set(1.16, 1, 0.74);
    hem.castShadow = true;
    bodyGroup.add(hem);

    // Upper body pivoted at waist y = 0.78 so leaning/slumping keeps boots planted on ground
    const upperBody = new THREE.Group();
    upperBody.position.set(0, 0.78, 0);
    bodyGroup.add(upperBody);

    // Belt + buckle
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.212, 0.065, 6), beltMat);
    belt.position.y = 0.055;
    belt.scale.set(1.16, 1, 0.74);
    upperBody.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), buckleMat);
    buckle.position.set(0, 0.055, 0.155);
    upperBody.add(buckle);

    // Torso / tunic (scaled by breathing)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.2, 0.45, 6), tunicMat);
    torso.position.y = 0.295;
    torso.scale.set(1.18, 1, 0.74);
    torso.castShadow = true;
    upperBody.add(torso);

    // Tunic collar / yoke
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.22, 0.095, 6), trimMat);
    collar.position.y = 0.525;
    collar.scale.set(1.14, 1, 0.78);
    collar.castShadow = true;
    upperBody.add(collar);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.074, 0.1, 6), skinMat);
    neck.position.y = 0.59;
    upperBody.add(neck);

    // Gender-neutral low-poly head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.735, 0);
    upperBody.add(headGroup);

    const headMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.172, 1), skinMat);
    headMesh.scale.set(0.94, 1.05, 0.98);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Neutral short cropped low-poly hair cap
    const hairCap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.184, 1), hairMat);
    hairCap.scale.set(0.98, 0.82, 1.02);
    hairCap.position.set(0, 0.058, -0.022);
    hairCap.castShadow = true;
    headGroup.add(hairCap);

    // Subtle neutral brow, nose, eyes, and ears
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.052, 4), skinMat);
    nose.rotation.x = Math.PI * 0.45;
    nose.position.set(0, -0.012, 0.165);
    headGroup.add(nose);

    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.016), eyeMat);
    leftEye.position.set(-0.056, 0.018, 0.152);
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.016), eyeMat);
    rightEye.position.set(0.056, 0.018, 0.152);
    headGroup.add(leftEye, rightEye);

    const leftEar = new THREE.Mesh(new THREE.DodecahedronGeometry(0.032, 0), skinMat);
    leftEar.scale.set(0.55, 1.0, 0.85);
    leftEar.position.set(-0.162, 0.0, -0.005);
    const rightEar = new THREE.Mesh(new THREE.DodecahedronGeometry(0.032, 0), skinMat);
    rightEar.scale.set(0.55, 1.0, 0.85);
    rightEar.position.set(0.162, 0.0, -0.005);
    headGroup.add(leftEar, rightEar);

    // Articulated arms with shoulders, sleeves, cuffs & hands
    const makeArm = (xPos: number): THREE.Group => {
      const shoulder = new THREE.Group();
      shoulder.position.set(xPos, 0.47, 0);

      const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), trimMat);
      cap.castShadow = true;
      shoulder.add(cap);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.25, 6), tunicMat);
      upper.position.y = -0.135;
      upper.castShadow = true;
      shoulder.add(upper);

      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.22, 6), tunicMat);
      lower.position.y = -0.35;
      lower.castShadow = true;
      shoulder.add(lower);

      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.052, 0.045, 6), trimMat);
      cuff.position.y = -0.455;
      shoulder.add(cuff);

      const hand = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05, 0), skinMat);
      hand.scale.set(0.85, 1.05, 0.72);
      hand.position.y = -0.505;
      hand.castShadow = true;
      shoulder.add(hand);

      return shoulder;
    };

    const leftArm = makeArm(-0.285);
    const rightArm = makeArm(0.285);
    upperBody.add(leftArm, rightArm);

    const memorialGlow = new THREE.PointLight(0xa3c8ff, 0, 5);
    memorialGlow.position.set(0, 1.1, 0);
    root.add(memorialGlow);

    return {
      root,
      bodyGroup,
      upperBody,
      torso,
      headGroup,
      leftArm,
      rightArm,
      leftLeg: leftLegRig.hip,
      rightLeg: rightLegRig.hip,
      leftShin: leftLegRig.shin,
      rightShin: rightLegRig.shin,
      memorialGlow,
    };
  }

  private applyAtmosphere(timeOfDay: TimeOfDay, weather: string): void {
    const preset = SKY_PRESETS[timeOfDay] ?? SKY_PRESETS.day;
    this.scene.background = new THREE.Color(preset.bg);
    this.fog.color.setHex(preset.fog);
    const w = weather.toLowerCase();
    this.fog.density = w === "fog" ? 0.018 : w === "rain" || w === "snow" ? 0.0085 : 0.0038;

    this.sunLight.color.setHex(preset.sunColor);
    this.sunLight.intensity =
      w === "cloudy" || w === "rain" ? preset.sunIntensity * 0.68 : preset.sunIntensity;
    this.sunLight.position.set(...preset.sunPos);

    this.hemiLight.color.setHex(preset.hemiSky);
    this.hemiLight.groundColor.setHex(preset.hemiGround);
    this.hemiLight.intensity = preset.hemiIntensity;

    const targetPrecip = w === "rain" ? "rain" : w === "snow" ? "snow" : "none";
    if (targetPrecip !== this.precipKind) {
      this.setPrecipitation(targetPrecip);
    }
  }

  private setPrecipitation(kind: "none" | "rain" | "snow"): void {
    this.precipKind = kind;
    if (this.precipPoints) {
      this.scene.remove(this.precipPoints);
      this.precipPoints.geometry.dispose();
      (this.precipPoints.material as THREE.Material).dispose();
      this.precipPoints = null;
    }
    if (kind === "none") return;

    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 32;
      positions[i * 3 + 1] = Math.random() * 14 + 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 32;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: kind === "snow" ? 0xf2f6ff : 0x9bc4e8,
      size: kind === "snow" ? 0.14 : 0.08,
      transparent: true,
      opacity: 0.72,
    });
    this.precipPoints = new THREE.Points(geo, mat);
    this.scene.add(this.precipPoints);
  }

  private clearFireProps(): void {
    for (const props of this.fireProps.values()) props.dispose();
    this.fireProps.clear();
  }

  private applyFireVisuals(fires: TimelineState["fires"]): void {
    const present = new Set<string>();
    const hearth = this.currentMap?.hearth;
    for (const fire of fires) {
      present.add(fire.id);
      let props = this.fireProps.get(fire.id);
      if (!props) {
        const atHearth =
          fire.id === "hearth_fire" || (fire.x === hearth?.x && fire.z === hearth?.z);
        props = new FireProps(atHearth);
        this.worldGroup.add(props.root);
        this.fireProps.set(fire.id, props);
      }
      props.root.position.set(fire.x, this.getFloorY(fire.x, fire.z), fire.z);
      props.applyState(fire.state);
    }
    for (const [id, props] of this.fireProps) {
      if (present.has(id)) continue;
      props.dispose();
      this.fireProps.delete(id);
    }
  }

  private animateCharacter(now: number, dt: number): void {
    const state = this.latestState;
    if (!state) return;

    const {
      root,
      bodyGroup,
      upperBody,
      torso,
      headGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      leftShin,
      rightShin,
      memorialGlow,
    } = this.character;

    const lerpAlpha = Math.min(1, dt * 6);
    // Sample the recorded polyline between timeline updates. Easing x/z toward the last
    // sampled pose cuts across bends and can cross objects the walk routes around.
    let target = state.pose;
    let onBed = false;
    const walk = state.walk;
    if (walk) {
      const elapsed = Math.max(0, Math.min(TIMELINE_SAMPLE_MS, now - this.latestStateReceivedAt));
      const atMs = state.atMs + elapsed * this.playbackRate;
      target = interpolateWaypoints(
        walk.waypoints,
        (atMs - walk.startMs) / Math.max(1, walk.endMs - walk.startMs),
      );
    } else if (state.poseAnim === "sleep" && this.currentMap) {
      const placement = restPose(this.currentMap, state);
      target = placement;
      onBed = placement.onBed;
    }
    root.position.set(target.x, this.getFloorY(target.x, target.z), target.z);

    // Shortest-angle heading interpolation
    let dAngle = target.heading - root.rotation.y;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    root.rotation.y += dAngle * (state.poseAnim === "sleep" ? 1 : lerpAlpha);

    // Breathing driven by physiology breath_rate (breaths/min)
    const breathHz = Math.max(6, Math.min(35, state.physiology.breath_rate)) / 60;
    const breathWave = Math.sin(this.animClock * Math.PI * 2 * breathHz);
    const breathScale = state.alive ? 1 + breathWave * 0.032 : 1;
    torso.scale.set(1.18 * breathScale, 1, 0.74 * breathScale);

    // Posture slump driven by heaviness & posture_openness
    const slump =
      state.physiology.heaviness * 0.22 + (1 - state.physiology.posture_openness) * 0.14;

    const pose: CharacterPoseAnim = state.poseAnim;
    bodyGroup.position.set(0, 0, 0);
    bodyGroup.rotation.set(0, 0, 0);
    upperBody.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    leftShin.rotation.x = 0;
    rightShin.rotation.x = 0;
    memorialGlow.intensity = 0;

    if (pose === "dead") {
      // Back rests cleanly on floor/ground
      bodyGroup.position.set(0, 0.14, 0.65);
      bodyGroup.rotation.x = -Math.PI / 2;
      leftArm.rotation.x = 0.12;
      rightArm.rotation.x = -0.12;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      memorialGlow.intensity = 1.4;
    } else if (pose === "sleep") {
      bodyGroup.position.set(0, onBed ? 0.5 : 0.18, WORLD_CONFIG.shelter.restHalfLength);
      bodyGroup.rotation.x = -Math.PI / 2;
      leftArm.rotation.x = 0.06;
      rightArm.rotation.x = 0.06;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
    } else if (pose === "walk") {
      const phase = this.animClock * 7.2;
      const swing = Math.sin(phase) * 0.52;
      // Subtle upward stride bounce (>= 0 so feet never sink into ground)
      bodyGroup.position.y = Math.abs(Math.sin(phase)) * 0.03;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftShin.rotation.x = Math.max(0, -swing * 0.55);
      rightShin.rotation.x = Math.max(0, swing * 0.55);
      leftArm.rotation.x = -swing * 0.65;
      rightArm.rotation.x = swing * 0.65;
      upperBody.rotation.x = 0.08 + slump * 0.5;
    } else if (pose === "desk") {
      // Seated pose with shins vertical and boots planted on floor
      bodyGroup.position.y = -0.24;
      upperBody.rotation.x = 0.16;
      const typeWave = Math.sin(this.animClock * 8) * 0.12;
      leftArm.rotation.x = -0.88 + typeWave;
      rightArm.rotation.x = -0.88 - typeWave;
      leftLeg.rotation.x = -1.28;
      rightLeg.rotation.x = -1.28;
      leftShin.rotation.x = 1.28;
      rightShin.rotation.x = 1.28;
    } else if (pose === "tend_fire") {
      // Crouched pose with boots planted on floor
      bodyGroup.position.y = -0.24;
      upperBody.rotation.x = 0.36;
      const poke = Math.sin(this.animClock * 3.5) * 0.16;
      leftArm.rotation.x = -0.9 + poke;
      rightArm.rotation.x = -1.05 - poke;
      leftLeg.rotation.x = -1.22;
      rightLeg.rotation.x = -1.22;
      leftShin.rotation.x = 1.22;
      rightShin.rotation.x = 1.22;
    } else if (pose === "gather") {
      const reach = Math.sin(this.animClock * 4.2) * 0.35;
      leftArm.rotation.x = -0.7 + reach;
      rightArm.rotation.x = -0.9 - reach;
      leftLeg.rotation.x = 0.08;
      rightLeg.rotation.x = -0.08;
      upperBody.rotation.x = 0.24;
    } else if (pose === "consume") {
      const sip = Math.sin(this.animClock * 3.2) * 0.18;
      rightArm.rotation.x = -1.32 + sip;
      leftArm.rotation.x = -0.15;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      upperBody.rotation.x = slump * 0.5;
    } else {
      // idle & thinking
      upperBody.rotation.x = slump;
      if (state.thinking) {
        headGroup.rotation.y = Math.sin(this.animClock * 1.1) * 0.16;
        headGroup.rotation.x = -0.05 + Math.sin(this.animClock * 0.8) * 0.04;
        rightArm.rotation.x = -0.45 + Math.sin(this.animClock * 1.4) * 0.05;
        leftArm.rotation.x = Math.sin(this.animClock * 1.2) * 0.04;
      } else {
        headGroup.rotation.y = Math.sin(this.animClock * 0.65) * 0.08;
        leftArm.rotation.x = Math.sin(this.animClock * 1.4) * 0.04;
        rightArm.rotation.x = -Math.sin(this.animClock * 1.4) * 0.04;
      }
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
    }

    if (this.cameraMode === "follow") {
      this.controls.target.lerp(
        new THREE.Vector3(root.position.x, root.position.y + 1.0, root.position.z),
        Math.min(1, dt * 4),
      );
    }
  }

  private startLoop(): void {
    const tick = (now: number): void => {
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.1, Math.max(0.001, (now - this.lastFrameMs) / 1000));
      this.lastFrameMs = now;
      this.animClock += dt;

      this.animateCharacter(now, dt);

      for (const props of this.fireProps.values()) props.flicker(this.animClock);

      // Subtle water surface shimmer
      if (this.waterMeshes.length > 0) {
        const shimmer = 0.12 + Math.sin(this.animClock * 1.8) * 0.035;
        for (const wm of this.waterMeshes) {
          const mat = wm.material as THREE.MeshStandardMaterial;
          mat.roughness = shimmer;
        }
      }

      // Animate rain / snow particles
      if (this.precipPoints) {
        const pos = this.precipPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
        const speed = this.precipKind === "snow" ? 1.8 : 11.5;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - speed * dt;
          if (y < 0.1) y = 14.5;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
