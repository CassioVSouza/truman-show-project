import { generateMap, type WorldMap } from "@truman/world";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CharacterPoseAnim, TimelineState, TimeOfDay } from "../state/timeline";

export type CameraMode = "follow" | "cabin" | "world";

interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
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
    bg: 0x35435e,
    fog: 0x4b556e,
    sunColor: 0xffb37b,
    sunIntensity: 1.15,
    sunPos: [30, 14, -20],
    hemiSky: 0x9bb2d8,
    hemiGround: 0x39322c,
    hemiIntensity: 0.7,
  },
  day: {
    bg: 0x7ba7cc,
    fog: 0x8eb4d1,
    sunColor: 0xfff5dc,
    sunIntensity: 1.55,
    sunPos: [24, 38, 18],
    hemiSky: 0xcbe4ff,
    hemiGround: 0x44523a,
    hemiIntensity: 0.85,
  },
  dusk: {
    bg: 0x2c2a45,
    fog: 0x3f3652,
    sunColor: 0xff8254,
    sunIntensity: 0.95,
    sunPos: [-28, 10, 22],
    hemiSky: 0x7a6592,
    hemiGround: 0x2a2422,
    hemiIntensity: 0.55,
  },
  night: {
    bg: 0x0b101d,
    fog: 0x101829,
    sunColor: 0x8ab0e6,
    sunIntensity: 0.35,
    sunPos: [-18, 28, -24],
    hemiSky: 0x223254,
    hemiGround: 0x14171c,
    hemiIntensity: 0.35,
  },
};

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

  private fireLight: THREE.PointLight | null = null;
  private fireFlames: THREE.Mesh[] = [];
  private precipPoints: THREE.Points | null = null;
  private precipKind: "none" | "rain" | "snow" = "none";

  private currentSeed: number | null = null;
  private cameraMode: CameraMode = "cabin";
  private latestState: TimelineState | null = null;
  private rafId: number | null = null;
  private lastFrameMs = performance.now();
  private animClock = 0;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_PRESETS.day.bg);
    this.fog = new THREE.FogExp2(SKY_PRESETS.day.fog, 0.0085);
    this.scene.fog = this.fog;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 320);
    this.camera.position.set(6.8, 6.2, 7.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 0.9, 0);

    this.hemiLight = new THREE.HemisphereLight(0xcbe4ff, 0x44523a, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5dc, 1.5);
    this.sunLight.position.set(24, 38, 18);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 110;
    const d = 24;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);

    this.scene.add(this.worldGroup);

    this.character = this.buildCharacter();
    this.scene.add(this.character.root);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.startLoop();
  }

  setSeed(seed: number): void {
    if (this.currentSeed === seed) return;
    this.currentSeed = seed;
    const map = generateMap(seed);
    this.rebuildWorld(map);
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    if (mode === "cabin") {
      this.camera.position.set(6.5, 5.8, 6.8);
      this.controls.target.set(0, 0.9, 0);
    } else if (mode === "world") {
      this.camera.position.set(0, 52, 58);
      this.controls.target.set(0, 0, 0);
    } else if (mode === "follow" && this.latestState) {
      const p = this.latestState.pose;
      this.camera.position.set(p.x + 4.2, 3.8, p.z + 4.4);
      this.controls.target.set(p.x, 1.0, p.z);
    }
  }

  applyTimelineState(state: TimelineState): void {
    this.latestState = state;
    this.applyAtmosphere(state.timeOfDay, state.weather);
    this.applyFireVisual(state.fire.state);
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.controls.dispose();
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

  private rebuildWorld(map: WorldMap): void {
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]!);
    }
    this.fireFlames = [];
    this.fireLight = null;

    // 1. Ground disc
    const groundGeo = new THREE.CircleGeometry(map.radius + 8, 48);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3b4d34, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.worldGroup.add(ground);

    // 2. Cabin interior & cutaway walls
    this.buildCabin(map);

    // 3. River ribbon
    this.buildRiver(map);

    // 4. Mirror pool & spring
    const poolGeo = new THREE.CircleGeometry(map.pool.radius, 28);
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0x5c89a8,
      metalness: 0.72,
      roughness: 0.14,
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(map.pool.x, 0.03, map.pool.z);
    this.worldGroup.add(pool);

    const springMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.1, 0.15, 10),
      new THREE.MeshStandardMaterial({ color: 0x62a8cc, roughness: 0.25 }),
    );
    springMesh.position.set(map.spring.x, 0.07, map.spring.z);
    this.worldGroup.add(springMesh);

    // 5. Resource nodes (instanced low-poly trees + bushes + woodpile)
    this.buildResourceNodes(map);

    // 6. Thorn-edge perimeter ring
    this.buildThornPerimeter(map.radius);
  }

  private buildCabin(map: WorldMap): void {
    const hw = map.cabin.halfW;
    const hd = map.cabin.halfD;
    const cabinGroup = new THREE.Group();

    const woodDark = new THREE.MeshStandardMaterial({ color: 0x5a3e2b, roughness: 0.88 });
    const woodFloor = new THREE.MeshStandardMaterial({ color: 0x76543a, roughness: 0.85 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5b5f66, roughness: 0.92 });
    const fabricMat = new THREE.MeshStandardMaterial({ color: 0x586f8c, roughness: 0.85 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.9 });

    // Floor platform
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 2 + 0.3, 0.16, hd * 2 + 0.3),
      woodFloor,
    );
    floor.position.set(0, 0.08, 0);
    floor.receiveShadow = true;
    cabinGroup.add(floor);

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

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, 0.75, hd * 2), woodDark);
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
    cabinGroup.add(bedFrame);

    const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.12, 1.2), fabricMat);
    blanket.position.set(bedPos.x, 0.56, bedPos.z + 0.18);
    cabinGroup.add(blanket);

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.32), pillowMat);
    pillow.position.set(bedPos.x, 0.58, bedPos.z - 0.56);
    cabinGroup.add(pillow);

    // Desk & glowing terminal at stations.desk
    const deskPos = map.stations.desk;
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.65), woodDark);
    deskTop.position.set(deskPos.x, 0.82, deskPos.z);
    deskTop.castShadow = true;
    cabinGroup.add(deskTop);

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
    const jt = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.72, 0.58), woodDark);
    jt.position.set(jtPos.x, 0.44, jtPos.z);
    jt.castShadow = true;
    cabinGroup.add(jt);

    const notebook = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.24), pillowMat);
    notebook.position.set(jtPos.x, 0.82, jtPos.z);
    cabinGroup.add(notebook);

    // Hearth / stove at map.hearth
    const hPos = map.hearth;
    const hearthBase = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.42, 8), stoneMat);
    hearthBase.position.set(hPos.x, 0.35, hPos.z);
    hearthBase.castShadow = true;
    cabinGroup.add(hearthBase);

    const flameMat1 = new THREE.MeshBasicMaterial({ color: 0xff8a2b });
    const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xffd15c });
    const flame1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.46, 6), flameMat1);
    flame1.position.set(hPos.x, 0.72, hPos.z);
    const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 5), flameMat2);
    flame2.position.set(hPos.x + 0.05, 0.68, hPos.z - 0.04);
    cabinGroup.add(flame1, flame2);
    this.fireFlames.push(flame1, flame2);

    const fLight = new THREE.PointLight(0xff9438, 2.2, 9.5, 1.8);
    fLight.position.set(hPos.x, 0.95, hPos.z);
    cabinGroup.add(fLight);
    this.fireLight = fLight;

    this.worldGroup.add(cabinGroup);
  }

  private buildRiver(map: WorldMap): void {
    if (map.river.length < 2) return;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3b7699,
      roughness: 0.22,
      metalness: 0.35,
    });
    for (let i = 0; i < map.river.length - 1; i++) {
      const a = map.river[i]!;
      const b = map.river[i + 1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(map.riverWidth, len + 0.8), mat);
      seg.rotation.x = -Math.PI / 2;
      seg.rotation.z = -Math.atan2(dx, dz);
      seg.position.set((a.x + b.x) / 2, 0.025, (a.z + b.z) / 2);
      this.worldGroup.add(seg);
    }
  }

  private buildResourceNodes(map: WorldMap): void {
    const trees = map.nodes.filter((n) => n.kind === "tree" || n.kind === "fruit_tree");
    const bushes = map.nodes.filter((n) => n.kind === "berry_bush" || n.kind === "herb_patch");
    const woodpiles = map.nodes.filter((n) => n.kind === "woodpile" || n.kind === "deadwood");

    // Instanced trees for high performance
    if (trees.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x543a27, roughness: 0.9 });
      const crownGeo = new THREE.ConeGeometry(1.25, 3.2, 6);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0x2a5432, roughness: 0.88 });

      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
      const crowns = new THREE.InstancedMesh(crownGeo, crownMat, trees.length);
      trunks.castShadow = true;
      crowns.castShadow = true;

      const dummy = new THREE.Object3D();
      trees.forEach((t, i) => {
        const scale = 0.85 + ((i * 37) % 10) * 0.04;
        dummy.position.set(t.x, 0.9 * scale, t.z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, 2.7 * scale, t.z);
        dummy.updateMatrix();
        crowns.setMatrixAt(i, dummy.matrix);
      });
      this.worldGroup.add(trunks, crowns);
    }

    if (bushes.length > 0) {
      const bushGeo = new THREE.DodecahedronGeometry(0.48, 0);
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.9 });
      const inst = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);
      const dummy = new THREE.Object3D();
      bushes.forEach((b, i) => {
        dummy.position.set(b.x, 0.35, b.z);
        dummy.scale.set(1, 0.78, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      this.worldGroup.add(inst);
    }

    const logMat = new THREE.MeshStandardMaterial({ color: 0x6b472d, roughness: 0.92 });
    for (const wp of woodpiles) {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.65, 6), logMat);
        log.rotation.z = Math.PI / 2;
        log.position.set(0, 0.14 + (i === 2 ? 0.14 : 0), (i - 1) * 0.16);
        g.add(log);
      }
      g.position.set(wp.x, 0.08, wp.z);
      this.worldGroup.add(g);
    }
  }

  private buildThornPerimeter(radius: number): void {
    const count = 72;
    const geo = new THREE.ConeGeometry(1.6, 5.2, 5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x222620, roughness: 0.95 });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = radius - 1.5;
      dummy.position.set(Math.sin(a) * r, 2.4, Math.cos(a) * r);
      dummy.rotation.y = a;
      dummy.scale.set(1.1, 0.85 + (i % 3) * 0.25, 1.1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    this.worldGroup.add(inst);
  }

  private buildCharacter(): CharacterRig {
    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    const coatMat = new THREE.MeshStandardMaterial({ color: 0xc2956b, roughness: 0.78 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3b4754, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe3c4a8, roughness: 0.72 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.24), coatMat);
    torso.position.y = 1.04;
    torso.castShadow = true;
    bodyGroup.add(torso);

    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), skinMat);
    head.position.y = 1.5;
    head.castShadow = true;
    bodyGroup.add(head);

    const makeLimb = (w: number, h: number, mat: THREE.Material, yOff: number): THREE.Group => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      mesh.position.y = yOff;
      mesh.castShadow = true;
      pivot.add(mesh);
      return pivot;
    };

    const leftArm = makeLimb(0.13, 0.48, coatMat, -0.22);
    leftArm.position.set(-0.29, 1.26, 0);
    const rightArm = makeLimb(0.13, 0.48, coatMat, -0.22);
    rightArm.position.set(0.29, 1.26, 0);

    const leftLeg = makeLimb(0.15, 0.58, pantsMat, -0.29);
    leftLeg.position.set(-0.11, 0.74, 0);
    const rightLeg = makeLimb(0.15, 0.58, pantsMat, -0.29);
    rightLeg.position.set(0.11, 0.74, 0);

    bodyGroup.add(leftArm, rightArm, leftLeg, rightLeg);

    const memorialGlow = new THREE.PointLight(0xa3c8ff, 0, 5);
    memorialGlow.position.set(0, 1.1, 0);
    root.add(memorialGlow);

    return { root, bodyGroup, torso, head, leftArm, rightArm, leftLeg, rightLeg, memorialGlow };
  }

  private applyAtmosphere(timeOfDay: TimeOfDay, weather: string): void {
    const preset = SKY_PRESETS[timeOfDay] ?? SKY_PRESETS.day;
    this.scene.background = new THREE.Color(preset.bg);
    this.fog.color.setHex(preset.fog);
    const w = weather.toLowerCase();
    this.fog.density = w === "fog" ? 0.026 : w === "rain" || w === "snow" ? 0.015 : 0.0075;

    this.sunLight.color.setHex(preset.sunColor);
    this.sunLight.intensity =
      w === "cloudy" || w === "rain" ? preset.sunIntensity * 0.65 : preset.sunIntensity;
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

  private applyFireVisual(fireState: TimelineState["fire"]["state"]): void {
    const visible = fireState !== "out";
    const scale =
      fireState === "burning" ? 1 : fireState === "lit" ? 0.75 : fireState === "dying" ? 0.45 : 0;
    for (const f of this.fireFlames) {
      f.visible = visible;
      f.scale.set(scale, scale, scale);
    }
    if (this.fireLight) {
      this.fireLight.intensity =
        fireState === "burning" ? 2.2 : fireState === "lit" ? 1.4 : fireState === "dying" ? 0.7 : 0;
    }
  }

  private animateCharacter(dt: number): void {
    const state = this.latestState;
    if (!state) return;

    const { root, bodyGroup, torso, leftArm, rightArm, leftLeg, rightLeg, memorialGlow } =
      this.character;
    const lerpAlpha = Math.min(1, dt * 6);
    root.position.x += (state.pose.x - root.position.x) * lerpAlpha;
    root.position.z += (state.pose.z - root.position.z) * lerpAlpha;

    // Shortest-angle heading interpolation
    let dAngle = state.pose.heading - root.rotation.y;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    root.rotation.y += dAngle * lerpAlpha;

    // Breathing driven by physiology breath_rate (breaths/min)
    const breathHz = Math.max(6, Math.min(35, state.physiology.breath_rate)) / 60;
    const breathWave = Math.sin(this.animClock * Math.PI * 2 * breathHz);
    const breathScale = state.alive ? 1 + breathWave * 0.035 : 1;
    torso.scale.set(breathScale, 1, breathScale);

    // Posture slump driven by heaviness & posture_openness
    const slump =
      state.physiology.heaviness * 0.22 + (1 - state.physiology.posture_openness) * 0.14;

    const pose: CharacterPoseAnim = state.poseAnim;
    bodyGroup.position.set(0, 0.16, 0);
    bodyGroup.rotation.set(0, 0, 0);
    memorialGlow.intensity = 0;

    if (pose === "dead") {
      bodyGroup.position.set(0, 0.3, 0);
      bodyGroup.rotation.x = -Math.PI / 2;
      leftArm.rotation.x = 0.1;
      rightArm.rotation.x = -0.1;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      memorialGlow.intensity = 1.4;
    } else if (pose === "sleep") {
      bodyGroup.position.set(0, 0.62, 0);
      bodyGroup.rotation.x = -Math.PI / 2;
      leftArm.rotation.x = 0.05;
      rightArm.rotation.x = 0.05;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
    } else if (pose === "walk") {
      const swing = Math.sin(this.animClock * 7.2) * 0.55;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.7;
      rightArm.rotation.x = swing * 0.7;
      bodyGroup.rotation.x = 0.08 + slump * 0.5;
    } else if (pose === "desk") {
      bodyGroup.position.y = 0.02;
      bodyGroup.rotation.x = 0.18;
      const typeWave = Math.sin(this.animClock * 8) * 0.12;
      leftArm.rotation.x = -0.85 + typeWave;
      rightArm.rotation.x = -0.85 - typeWave;
      leftLeg.rotation.x = -0.45;
      rightLeg.rotation.x = -0.45;
    } else if (pose === "tend_fire") {
      bodyGroup.position.y = -0.14;
      bodyGroup.rotation.x = 0.36;
      const poke = Math.sin(this.animClock * 3.5) * 0.16;
      leftArm.rotation.x = -0.9 + poke;
      rightArm.rotation.x = -1.05 - poke;
      leftLeg.rotation.x = -0.5;
      rightLeg.rotation.x = -0.5;
    } else if (pose === "gather") {
      const reach = Math.sin(this.animClock * 4.2) * 0.35;
      leftArm.rotation.x = -0.7 + reach;
      rightArm.rotation.x = -0.9 - reach;
      leftLeg.rotation.x = 0.1;
      rightLeg.rotation.x = -0.1;
      bodyGroup.rotation.x = 0.22;
    } else if (pose === "consume") {
      const sip = Math.sin(this.animClock * 3.2) * 0.18;
      rightArm.rotation.x = -1.35 + sip;
      leftArm.rotation.x = -0.15;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
    } else {
      // idle
      bodyGroup.rotation.x = slump;
      leftArm.rotation.x = Math.sin(this.animClock * 1.4) * 0.04;
      rightArm.rotation.x = -Math.sin(this.animClock * 1.4) * 0.04;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
    }

    if (this.cameraMode === "follow") {
      this.controls.target.lerp(
        new THREE.Vector3(root.position.x, 1.0, root.position.z),
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

      this.animateCharacter(dt);

      // Flicker fire flames
      if (this.fireFlames.length > 0 && this.latestState && this.latestState.fire.state !== "out") {
        const flicker = 0.92 + Math.sin(this.animClock * 15) * 0.1;
        this.fireFlames.forEach((f, idx) => {
          f.rotation.y = this.animClock * (idx === 0 ? 1.8 : -2.3);
          f.scale.y = Math.max(0.2, f.scale.x * flicker);
        });
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
