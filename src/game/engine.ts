import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GothicAudioEngine } from './audio';
import { buildGothicCity, type CityWorldData, type WorldVolume } from './cityLayout';
import {
  createGothicMaterialLibrary,
  type GothicMaterialLibrary,
  type StylizedShaderUniforms,
} from './materials';
import {
  createNpcModel,
  createVampireFirstPersonArms,
  createVampireModel,
  GUARD_HALF_FOV,
  GUARD_VISION_RANGE,
  VISION_CONE_RAYS,
  type AlarmBellInstance,
  type BreakablePropInstance,
  type MemoryFragmentInstance,
  type NpcModelRig,
  type StreetLampInstance,
  type VampireFirstPersonRig,
  type VampireRig,
} from './models';
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import type { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createShadowComposer, PS2_INTERNAL_SCALE } from './postprocessing';
import { createGothicTextures, type GothicTextures } from './textures';
import {
  ACTIVE_POWER_LIST,
  ALL_SKILL_NODES,
  DEFAULT_EQUIPPED_POWERS,
  DEFAULT_HOTKEYS,
  DISCIPLINE_DEFINITIONS,
  DISTRICT_META,
  IMPORTANT_NPC_LORE,
  INITIAL_DISCIPLINE_LEVELS,
  INITIAL_UNLOCKED_SKILLS,
  MAX_EQUIPPED_SLOTS,
  MEMORY_FRAGMENTS,
  NPC_DOSSIER_PROFILES,
  WEATHER_META,
  formatKeyCodeLabel,
  isSkillNodeAvailable,
  type ActivePowerId,
  type ContextPrompt,
  type DisciplineId,
  type DisciplineLevels,
  type DistrictId,
  type GamePhase,
  type HotkeyBindings,
  type HudSnapshot,
  type HuntLogEntry,
  type NpcAlertState,
  type NpcArchetype,
  type NpcStatusTier,
  type SuspicionTier,
  type WeatherType,
} from './types';

// Pre-allocated math scratch objects (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _color2 = new THREE.Color();
const _color3 = new THREE.Color();
const _skyZenithTarget = new THREE.Color();
const _dawnGlowTarget = new THREE.Color();
const _sunStartPos = new THREE.Vector3(-28, 52, -32);
const _sunDawnPos = new THREE.Vector3(68, 22, -16);

interface NpcEntity {
  id: number;
  archetype: NpcArchetype;
  statusTier: NpcStatusTier;
  name: string;
  isMainTarget?: boolean;
  rig: NpcModelRig;
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  hp: number;
  maxHp: number;
  route: THREE.Vector3[];
  waypointIndex: number;
  state: NpcAlertState;
  suspicion: number; // 0..1
  stateTimer: number;
  investigateArrived: boolean;
  restTimer: number;
  restCooldown: number;
  shiftTimer: number;
  shiftDuration: number;
  investigatePos: THREE.Vector3;
  targetBell: AlarmBellInstance | null;
  escortTarget: NpcEntity | null;
  hasBodyguard: boolean;
  attackWindup: number;
  attackCooldown: number;
  attackSwingTimer: number;
  hitStaggerTimer: number;
  hitStaggerDuration: number;
  hitRecoilDir: number;
  deathFallTimer: number;
  deathFallStartRotX: number;
  deathFallStartY: number;
  frameMoveDirX: number;
  frameMoveDirZ: number;
  frameMoveSpeed: number;
  frameIsMoving: boolean;
  walkPhase: number;
  huntPoints: number;
  bloodReward: number;
  essenceReward: number;
  respawnTimer: number;
  corpseHidden: boolean;
  corpseDiscovered: boolean;
  lastStuckCheckPos: THREE.Vector3;
  stuckTimer: number;
  avoidSign: number;
  steerAngleOffset: number;
  possessTimer: number;
  possessPos: THREE.Vector3;
  boltCooldown: number;
}

interface ShadowProjectile {
  active: boolean;
  isEnemyBolt: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  mesh: THREE.Mesh;
}

interface PooledParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
  gravity: number;
  homingToVampire: boolean;
}

interface SoundRipple {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxRadius: number;
}

interface SmokePuff {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
  isDark: boolean;
}

interface AmbientMote {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function raycastAabb2D(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  maxDist: number,
  box: WorldVolume,
): number {
  let tmin = 0;
  let tmax = maxDist;

  if (Math.abs(dx) < 1e-6) {
    if (ox < box.minX || ox > box.maxX) return maxDist;
  } else {
    const inv = 1 / dx;
    let t1 = (box.minX - ox) * inv;
    let t2 = (box.maxX - ox) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return maxDist;
  }

  if (Math.abs(dz) < 1e-6) {
    if (oz < box.minZ || oz > box.maxZ) return maxDist;
  } else {
    const inv = 1 / dz;
    let t1 = (box.minZ - oz) * inv;
    let t2 = (box.maxZ - oz) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return maxDist;
  }

  return tmin >= 0 && tmin < maxDist ? tmin : maxDist;
}

function probeObstacleClearance(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  maxDist: number,
  footCheckY: number,
  headCheckY: number,
  padRadius: number,
  volumes: WorldVolume[],
): number {
  let closest = maxDist;
  const invX = Math.abs(dx) < 1e-6 ? 0 : 1 / dx;
  const invZ = Math.abs(dz) < 1e-6 ? 0 : 1 / dz;

  for (let i = 0; i < volumes.length; i++) {
    const b = volumes[i];
    if (b.maxY <= footCheckY || b.minY >= headCheckY) continue;

    const minX = b.minX - padRadius;
    const maxX = b.maxX + padRadius;
    const minZ = b.minZ - padRadius;
    const maxZ = b.maxZ + padRadius;

    let tmin = 0;
    let tmax = closest;

    if (invX === 0) {
      if (ox < minX || ox > maxX) continue;
    } else {
      let t1 = (minX - ox) * invX;
      let t2 = (maxX - ox) * invX;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }

    if (invZ === 0) {
      if (oz < minZ || oz > maxZ) continue;
    } else {
      let t1 = (minZ - oz) * invZ;
      let t2 = (maxZ - oz) * invZ;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }

    if (tmin >= 0 && tmin < closest) {
      closest = tmin;
    }
  }
  return closest;
}

function hasLineOfSight(
  a: THREE.Vector3,
  b: THREE.Vector3,
  volumes: WorldVolume[],
): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001) return true;
  const ndx = dx / dist;
  const ndz = dz / dist;
  const eyeY = Math.min(a.y, b.y) + 1.15;

  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i];
    if (!v.blocksSight) continue;
    if (eyeY < v.minY || eyeY > v.maxY) continue;
    const hitDist = raycastAabb2D(a.x, a.z, ndx, ndz, dist, v);
    if (hitDist < dist - 0.15) {
      return false;
    }
  }
  return true;
}

function getFloorHeightAt(
  x: number,
  z: number,
  currentY: number,
  radius: number,
  volumes: WorldVolume[],
  cryptBounds?: { minX: number; maxX: number; minZ: number; maxZ: number },
): number {
  const inCryptPit =
    cryptBounds !== undefined &&
    x >= 19.02 &&
    x <= 24.98 &&
    z >= -50.98 &&
    z <= -34.0 &&
    currentY <= 0.45;
  let highest = inCryptPit ? -2.8 : 0;
  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i];
    if (!v.walkableTop) continue;
    if (
      x + radius > v.minX &&
      x - radius < v.maxX &&
      z + radius > v.minZ &&
      z - radius < v.maxZ
    ) {
      if (v.maxY <= currentY + 0.55 && v.maxY > highest) {
        highest = v.maxY;
      }
    }
  }
  return highest;
}

function resolveHorizontal3D(
  pos: THREE.Vector3,
  radius: number,
  volumes: WorldVolume[],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  let collided = false;
  pos.x = THREE.MathUtils.clamp(pos.x, bounds.minX, bounds.maxX);
  pos.z = THREE.MathUtils.clamp(pos.z, bounds.minZ, bounds.maxZ);

  const footCheckY = pos.y + 0.65;
  const headCheckY = pos.y + 1.75;

  for (let i = 0; i < volumes.length; i++) {
    const b = volumes[i];
    if (b.maxY <= footCheckY || b.minY >= headCheckY) continue;

    const closestX = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX);
    const closestZ = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      collided = true;
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      } else {
        const penLeft = Math.abs(pos.x - b.minX);
        const penRight = Math.abs(b.maxX - pos.x);
        const penTop = Math.abs(pos.z - b.minZ);
        const penBot = Math.abs(b.maxZ - pos.z);
        const minPen = Math.min(penLeft, penRight, penTop, penBot);
        if (minPen === penLeft) pos.x = b.minX - radius;
        else if (minPen === penRight) pos.x = b.maxX + radius;
        else if (minPen === penTop) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
      }
    }
  }
  return collided;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onPhaseRequest: (phase: GamePhase) => void;
}

export class VampireGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private shadowPass: ShaderPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private audio = new GothicAudioEngine();

  private sharedUniforms: StylizedShaderUniforms = {
    uTime: { value: 0 },
    uCrimsonSense: { value: 0 },
    uWindDir: { value: new THREE.Vector2(0.85, 0.52) },
    uWindStrength: { value: 0.65 },
  };

  private textures: GothicTextures;
  private mats: GothicMaterialLibrary;
  private world: CityWorldData;
  private vampire: VampireRig;
  private fpArms: VampireFirstPersonRig;
  private npcs: NpcEntity[] = [];
  private ambientBats: THREE.Mesh[] = [];

  // Lighting, SkyDome, Fog & Dynamic Weather
  private hemiLight!: THREE.HemisphereLight;
  private moonLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private skyDome!: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;
  private skyUniforms!: {
    uZenithColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uDawnGlowColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uDawnAmount: { value: number };
    uTime: { value: number };
  };
  private fogColor = new THREE.Color(0x03050d);
  private sceneFog!: THREE.FogExp2;
  private weather: WeatherType = 'clear';
  private weatherSchedule: WeatherType[] = ['clear', 'fog', 'rain', 'fog', 'rain', 'clear'];
  private weatherIndex = 0;
  private weatherTimer = 0;
  private weatherDuration = 24;
  private weatherVisionMult = 1.0;
  private weatherNoiseMult = 1.0;
  private rainIntensity = 0.0;
  private fogIntensity = 0.0;

  // Particle, Rain, Smoke & Sound Ripple pools
  private particleCount = 160;
  private particles: PooledParticle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private rainCount = 340;
  private rainDrops: Array<{ x: number; y: number; z: number; speed: number }> = [];
  private rainMesh!: THREE.InstancedMesh;
  private rainMat!: THREE.MeshBasicMaterial;
  private smokeCount = 96;
  private smokePuffs: SmokePuff[] = [];
  private smokeMesh: THREE.InstancedMesh;
  private smokeSpawnTimer = 0;
  private ambientMoteCount = 72;
  private ambientMotes: AmbientMote[] = [];
  private ambientMoteMesh: THREE.InstancedMesh;
  private ambientMoteSpawnTimer = 0;
  private nearbySmokeIndices: number[] = [];
  private nearbyLampIndices: number[] = [];
  private windAngle = 0.55;
  private windStrength = 0.65;
  private soundRipples: SoundRipple[] = [];

  // Game & Simulation state
  private phase: GamePhase = 'title';
  private frameId = 0;
  private destroyed = false;
  private lastHudPush = 0;

  // Player state
  private playerPos = new THREE.Vector3(-33, 0, 26);
  private playerVelY = 0;
  private isGrounded = true;
  private wasGrounded = true;
  private playerYaw = 0.6;
  private camYaw = 0.6;
  private camPitch = 0.0;
  private camEyeHeight = 1.66;
  private camSmoothFloorY = -2.4;
  private camBobY = 0;
  private camBobX = 0;
  private camRoll = 0;
  private lastHorizSpeed = 0;
  private walkCycle = 0;
  private health = 100;
  private maxHealth = 100;
  private blood = 92;
  private maxBlood = 100;
  private essence = 35;
  private pendingEssence = 0;
  private exposure = 0;
  private shadowImmersion = 0;
  private noiseLevel = 0;
  private noisePulse = 0;
  private footstepSoundCooldown = 0;
  private globalSuspicion = 0;
  private isCrouching = false;
  private isCrimsonSense = false;
  private crimsonTarget = 0;

  // Active action & combat timers
  private dashTimer = 0;
  private dashDir = new THREE.Vector3();
  private shadowVeilTimer = 0;
  private abyssalShroudTimer = 0;
  private batFormTimer = 0;
  private mistFormTimer = 0;
  private obfuscateTimer = 0;
  private falseVisageTimer = 0;
  private celerityTimer = 0;
  private astralActive = false;
  private astralPos = new THREE.Vector3();
  private astralYaw = 0;
  private astralPitch = 0.25;
  private astralOrb!: THREE.Mesh;
  private shadowDecoyGroup!: THREE.Group;
  private shadowDecoyBodyMat!: THREE.MeshBasicMaterial;
  private shadowDecoyRingMat!: THREE.MeshBasicMaterial;
  private shadowDecoyPos = new THREE.Vector3();
  private shadowDecoyTimer = 0;
  private shadowDecoyPulseTimer = 0;
  private darknessPulseRing!: THREE.Mesh;
  private darknessPulseMat!: THREE.MeshBasicMaterial;
  private darknessPulseTimer = 0;
  private darknessPulseMax = 0.55;
  private projectiles: ShadowProjectile[] = [];
  private castAnimTimer = 0;
  private clawSlashTimer = 0;
  private clawSlashDuration = 0.24;
  private clawComboStep = 0;
  private clawActiveComboStep = 0;
  private clawComboResetTimer = 0;
  private clawCooldown = 0;
  private feedTimer = 0;
  private feedDuration = 1.1;
  private feedTarget: NpcEntity | null = null;
  private feedIsAerial = false;
  private feedIsStealth = true;
  private feedTakedownKind: 'aerial' | 'guard' | 'noble' | 'cultist' | 'civilian' = 'civilian';
  private feedDesiredPos = new THREE.Vector3();
  private feedCamBlend = 0;
  private feedBloodTickTimer = 0;
  private feedWitnessed = false;
  private hitstopTimer = 0;
  private killSlowMoTimer = 0;
  private killCamIntensity = 0;
  private jumpLandAnimTimer = 0;
  private coyoteTimer = 0;
  private shakeIntensity = 0;
  private statusBanner: string | null = null;
  private statusBannerTimer = 0;
  private deathReason: string | null = null;

  // Progression & Night state
  private nightNumber = 1;
  private nightTimer = 0;
  private nightDuration = 220;
  private powerRegenTimer = 0;
  private dawnWarned = false;
  private dawnBroken = false;
  private dawnBurnTickTimer = 0;
  private dawnBurnAudioCooldown = 0;
  private quotaNotified = false;
  private lastNightSummary: HudSnapshot['lastNightSummary'] = null;
  private mainTargetName = 'Lorde Valerius';
  private mainTargetDistrict = DISTRICT_META.cemetery.name;
  private mainTargetDefeated = false;
  private killsThisNight = 0;
  private quotaThisNight = 7;
  private totalKills = 0;
  private noblesDrained = 0;
  private guardsSlain = 0;
  private collectedMemories: string[] = [];
  private encounteredTargets = new Set<string>();
  private discoveredWeaknesses: Record<string, Set<string>> = {};
  private huntLog: HuntLogEntry[] = [];
  private districtInfamy: Record<DistrictId, number> = {
    cathedral: 0,
    alleys: 0,
    avenue: 0,
    cemetery: 0,
  };
  private nextNpcId = 1;
  private disciplines: DisciplineLevels = { ...INITIAL_DISCIPLINE_LEVELS };
  private unlockedSkills = new Set<string>(INITIAL_UNLOCKED_SKILLS);
  private equippedPowers: ActivePowerId[] = [...DEFAULT_EQUIPPED_POWERS];
  private hotkeys: HotkeyBindings = { ...DEFAULT_HOTKEYS };
  private cooldowns: Record<Exclude<ActivePowerId, 'crimsonSense'>, number> = {
    shadowDash: 0,
    snuffLamp: 0,
    shadowSnare: 0,
    abyssalShroud: 0,
    darknessPulse: 0,
    obfuscate: 0,
    falseVisage: 0,
    shadowDecoy: 0,
    astralScout: 0,
    dominate: 0,
    memoryWipe: 0,
    possess: 0,
    batSwarm: 0,
    mistForm: 0,
    celerity: 0,
    shadowLeap: 0,
    shadowThrow: 0,
  };

  // Input tracking
  private heldKeys = new Set<string>();
  private justPressed = new Set<string>();
  private isDraggingCamera = false;
  private pointerLocked = false;
  private titleAngle = 0;

  // Bound listeners
  private onResizeBound: () => void;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onBlurBound: () => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseDownBound: (e: MouseEvent) => void;
  private onMouseUpBound: () => void;
  private onPointerLockChangeBound: () => void;
  private onWheelBound: (e: WheelEvent) => void;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = this.fogColor;
    this.sceneFog = new THREE.FogExp2(0x03050d, 0.0175);
    this.scene.fog = this.sceneFog;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.24;
    pmrem.dispose();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(66, width / height, 0.08, 280);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Nocturnal-to-Dawn Atmospheric Sky Dome
    this.skyUniforms = {
      uZenithColor: { value: new THREE.Color(0x020308) },
      uHorizonColor: { value: new THREE.Color(0x03050d) },
      uDawnGlowColor: { value: new THREE.Color(0x7c2d12) },
      uSunDir: { value: new THREE.Vector3(1.0, 0.22, -0.25).normalize() },
      uDawnAmount: { value: 0.0 },
      uTime: { value: 0.0 },
    };
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uDawnGlowColor;
        uniform vec3 uSunDir;
        uniform float uDawnAmount;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float elev = clamp(dir.y, 0.0, 1.0);
          vec3 sky = mix(uHorizonColor, uZenithColor, pow(elev, 0.52));

          // Faint nocturnal stars that dissolve cleanly as dawn approaches
          float nightMask = 1.0 - smoothstep(0.05, 0.48, uDawnAmount);
          if (nightMask > 0.01 && elev > 0.12) {
            vec3 cell = floor(dir * 160.0);
            float h = hash31(cell);
            if (h > 0.992) {
              float twinkle = 0.6 + 0.4 * sin(uTime * 1.8 + h * 120.0);
              float starIntensity = smoothstep(0.12, 0.35, elev) * nightMask * twinkle * 0.85;
              sky += vec3(0.75, 0.84, 1.0) * starIntensity;
            }
          }

          // Eastern pre-dawn horizon band & rising sun halo
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          float horizonBand = exp(-elev * 5.2);
          float eastMask = smoothstep(-0.2, 0.85, dir.x);
          sky += uDawnGlowColor * horizonBand * (0.25 + 0.75 * eastMask) * uDawnAmount * 1.15;
          sky += uDawnGlowColor * pow(sunDot, 10.0) * uDawnAmount * 0.95;
          sky += vec3(1.0, 0.82, 0.58) * pow(sunDot, 72.0) * smoothstep(0.5, 1.0, uDawnAmount) * 1.1;

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(215, 24, 14), this.skyMat);
    this.skyDome.renderOrder = -10;
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);

    // 3-Point Nocturnal Lighting Rig (deep midnight shadow contrast -> sharp lamp pools)
    this.hemiLight = new THREE.HemisphereLight(0x1c2852, 0x04050c, 0.18);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0x6b88cc, 0.48);
    this.moonLight.position.copy(_sunStartPos);
    this.moonLight.castShadow = !this.isSoftwareGl;
    this.moonLight.shadow.mapSize.width = 2048;
    this.moonLight.shadow.mapSize.height = 2048;
    this.moonLight.shadow.camera.near = 5;
    this.moonLight.shadow.camera.far = 175;
    const d = 76;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.moonLight.shadow.bias = -0.0005;
    this.moonLight.shadow.normalBias = 0.02;
    this.scene.add(this.moonLight);

    this.rimLight = new THREE.DirectionalLight(0x3b4899, 0.15);
    this.rimLight.position.set(30, 20, 40);
    this.scene.add(this.rimLight);

    this.textures = createGothicTextures(this.renderer);
    this.mats = createGothicMaterialLibrary(this.textures, this.sharedUniforms);
    this.world = buildGothicCity(this.scene, this.mats, this.textures);

    this.vampire = createVampireModel(this.mats, this.textures, this.sharedUniforms);
    this.vampire.root.position.copy(this.playerPos);
    this.scene.add(this.vampire.root);

    this.fpArms = createVampireFirstPersonArms(this.mats, this.sharedUniforms);
    this.fpArms.root.visible = false;
    this.camera.add(this.fpArms.root);

    // Particle Pool (InstancedMesh, HDR toneMapped=false so blood & magic sparks catch selective bloom)
    const pGeo = new THREE.OctahedronGeometry(0.14, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.particleCount);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        scale: 1,
        color: new THREE.Color(0xdc2626),
        gravity: 0,
        homingToVampire: false,
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.setHex(0xdc2626));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);

    // Pooled Ground Sound Ripples (acoustic feedback rings)
    const rippleGeo = new THREE.RingGeometry(0.75, 1.0, 28);
    rippleGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x94b8ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(rippleGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.soundRipples.push({
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 0.65,
        maxRadius: 6,
      });
    }

    // Pooled Wind-Blown Nocturnal Smoke & Dark Shadow Magic Plumes
    const smokeGeo = new THREE.IcosahedronGeometry(0.42, 0);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, this.smokeCount);
    this.smokeMesh.frustumCulled = false;
    for (let i = 0; i < this.smokeCount; i++) {
      this.smokePuffs.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 4.0,
        baseScale: 1,
        isDark: false,
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, _dummy.matrix);
      this.smokeMesh.setColorAt(i, _color.setHex(0x64748b));
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    if (this.smokeMesh.instanceColor) this.smokeMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.smokeMesh);

    // Pooled Discrete Environmental Motes (lamp embers, grate mist specks & crypt brazier sparks)
    const moteGeo = new THREE.OctahedronGeometry(0.055, 0);
    const moteMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      toneMapped: false,
    });
    this.ambientMoteMesh = new THREE.InstancedMesh(moteGeo, moteMat, this.ambientMoteCount);
    this.ambientMoteMesh.frustumCulled = false;
    for (let i = 0; i < this.ambientMoteCount; i++) {
      this.ambientMotes.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.8,
        baseScale: 0.7,
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.ambientMoteMesh.setMatrixAt(i, _dummy.matrix);
      this.ambientMoteMesh.setColorAt(i, _color.setHex(0xffb347));
    }
    this.ambientMoteMesh.instanceMatrix.needsUpdate = true;
    if (this.ambientMoteMesh.instanceColor) this.ambientMoteMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.ambientMoteMesh);

    // Dynamic Nocturnal Rain Streak Pool (InstancedMesh)
    const rainGeo = new THREE.CylinderGeometry(0.011, 0.008, 0.95, 4);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xa5b4fc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainMesh = new THREE.InstancedMesh(rainGeo, this.rainMat, this.rainCount);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    for (let i = 0; i < this.rainCount; i++) {
      this.rainDrops.push({
        x: (Math.random() - 0.5) * 44,
        y: Math.random() * 22,
        z: (Math.random() - 0.5) * 44,
        speed: 19 + Math.random() * 8,
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this.rainMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.rainMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.rainMesh);

    // Ambient Cathedral Bats
    const batGeo = new THREE.BufferGeometry();
    batGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          0, 0, 0, -0.5, 0.14, -0.1, -0.2, 0, 0.2,
          0, 0, 0, 0.2, 0, 0.2, 0.5, 0.14, -0.1,
        ]),
        3,
      ),
    );
    const batMat = new THREE.MeshBasicMaterial({ color: 0x0b0d14, side: THREE.DoubleSide });
    for (let i = 0; i < 16; i++) {
      const bat = new THREE.Mesh(batGeo, batMat);
      bat.position.set(Math.cos(i) * 16, 21 + (i % 5) * 2.5, -36 + Math.sin(i) * 14);
      this.scene.add(bat);
      this.ambientBats.push(bat);
    }

    // Astral Scout Projection Orb
    const astralGeo = new THREE.OctahedronGeometry(0.32, 1);
    const astralMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.78,
      toneMapped: false,
    });
    this.astralOrb = new THREE.Mesh(astralGeo, astralMat);
    this.astralOrb.visible = false;
    this.scene.add(this.astralOrb);

    // Pooled Shadow Decoy Silhouette (Simulacro Sombrio)
    this.shadowDecoyGroup = new THREE.Group();
    this.shadowDecoyBodyMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      toneMapped: false,
    });
    this.shadowDecoyRingMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const decoyTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.72, 3, 7), this.shadowDecoyBodyMat);
    decoyTorso.position.y = 0.96;
    const decoyHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 6), this.shadowDecoyBodyMat);
    decoyHead.position.y = 1.66;
    const decoyRingGeo = new THREE.RingGeometry(0.65, 0.88, 24);
    decoyRingGeo.rotateX(-Math.PI / 2);
    const decoyRing = new THREE.Mesh(decoyRingGeo, this.shadowDecoyRingMat);
    decoyRing.position.y = 0.06;
    this.shadowDecoyGroup.add(decoyTorso, decoyHead, decoyRing);
    this.shadowDecoyGroup.visible = false;
    this.scene.add(this.shadowDecoyGroup);

    // Pooled Darkness Pulse Shockwave Ring (Pulso de Escuridão)
    const pulseGeo = new THREE.RingGeometry(0.82, 1.0, 32);
    pulseGeo.rotateX(-Math.PI / 2);
    this.darknessPulseMat = new THREE.MeshBasicMaterial({
      color: 0x4f46e5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.darknessPulseRing = new THREE.Mesh(pulseGeo, this.darknessPulseMat);
    this.darknessPulseRing.visible = false;
    this.scene.add(this.darknessPulseRing);

    // Pooled Projectiles (Shadow Throw Darts & Hunter Silver Bolts)
    const projGeo = new THREE.ConeGeometry(0.08, 0.55, 6);
    projGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(projGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({
        active: false,
        isEnemyBolt: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        mesh,
      });
    }

    this.spawnNpcsForNight(1);

    if (!this.isSoftwareGl) {
      const pp = createShadowComposer(this.renderer, this.scene, this.camera);
      this.composer = pp.composer;
      this.bloomPass = pp.bloomPass;
      this.shadowPass = pp.shadowPass;
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind events
    this.onResizeBound = () => this.handleResize();
    this.onKeyDownBound = (e) => this.handleKeyDown(e);
    this.onKeyUpBound = (e) => this.handleKeyUp(e);
    this.onBlurBound = () => {
      this.heldKeys.clear();
      this.isDraggingCamera = false;
    };
    this.onMouseMoveBound = (e) => this.handleMouseMove(e);
    this.onMouseDownBound = (e) => this.handleMouseDown(e);
    this.onMouseUpBound = () => {
      this.isDraggingCamera = false;
    };
    this.onPointerLockChangeBound = () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
      this.pushHudSnapshot(true);
    };
    this.onWheelBound = () => {
      // First-person camera keeps fixed eye-level scale; wheel intentionally left passive
    };

    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onBlurBound);
    window.addEventListener('mousemove', this.onMouseMoveBound);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    this.renderer.domElement.addEventListener('wheel', this.onWheelBound, { passive: true });

    this.pushHudSnapshot(true);
    this.startLoop();
  }

  private getDistrictAt(pos: THREE.Vector3): DistrictId {
    if (pos.z < -22) return 'cathedral';
    if (pos.x >= 34 && pos.z < 45) return 'cemetery';
    if (pos.x < -16 && pos.z < 45) return 'alleys';
    return 'avenue';
  }

  private isNearSafeSanctuary(pos: THREE.Vector3): boolean {
    const cb = this.world.cryptBounds;
    return (
      pos.x >= cb.minX - 0.35 &&
      pos.x <= cb.maxX + 0.35 &&
      pos.z >= cb.minZ - 0.35 &&
      pos.z <= cb.maxZ + 0.35 &&
      pos.y <= 0.45
    );
  }

  private isInSafeCemetery(pos: THREE.Vector3): boolean {
    const cb = this.world.cemeteryBounds;
    return (
      pos.x >= cb.minX &&
      pos.x <= cb.maxX &&
      pos.z >= cb.minZ &&
      pos.z <= cb.maxZ &&
      pos.y <= 8.0
    );
  }

  private placeVampireInSanctuary(): void {
    this.playerPos.copy(this.world.safeSpawnPos);
    this.playerVelY = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    this.playerYaw = 0;
    this.camYaw = Math.PI - 0.06;
    this.camPitch = 0.0;
    this.camEyeHeight = 1.66;
    this.camSmoothFloorY = this.playerPos.y;
    this.camBobY = 0;
    this.camBobX = 0;
    this.camRoll = 0;
    this.lastHorizSpeed = 0;
    this.exposure = 0;
    this.shadowImmersion = 1.0;
    this.noiseLevel = 0;
    this.noisePulse = 0;
    this.dashTimer = 0;
    this.batFormTimer = 0;
    this.shadowVeilTimer = 0;
    this.abyssalShroudTimer = 0;
    this.mistFormTimer = 0;
    this.obfuscateTimer = 0;
    this.falseVisageTimer = 0;
    this.celerityTimer = 0;
    this.astralActive = false;
    if (this.astralOrb) this.astralOrb.visible = false;
    this.shadowDecoyTimer = 0;
    this.shadowDecoyPulseTimer = 0;
    if (this.shadowDecoyGroup) this.shadowDecoyGroup.visible = false;
    this.darknessPulseTimer = 0;
    if (this.darknessPulseRing) this.darknessPulseRing.visible = false;
    for (const p of this.projectiles) {
      p.active = false;
      p.mesh.visible = false;
    }
    this.castAnimTimer = 0;
    this.feedTarget = null;
    this.feedTimer = 0;
    this.feedIsAerial = false;
    this.feedCamBlend = 0;
    this.feedBloodTickTimer = 0;
    this.feedWitnessed = false;
    this.vampire.root.position.copy(this.playerPos);
    this.vampire.root.rotation.y = this.playerYaw;
    this.vampire.bodyPivot.position.y = 0;
    this.vampire.bodyPivot.rotation.set(0, 0, 0);
    this.vampire.spinePivot.rotation.set(0, 0, 0);
    this.vampire.head.rotation.set(0, 0, 0);
    this.vampire.cape.rotation.set(0.06, 0, 0);
    for (const def of this.vampire.stealthMatDefaults) {
      def.mat.color.setHex(def.baseColor);
      def.mat.emissive.setHex(0x000000);
      def.mat.emissiveIntensity = 0;
      def.mat.opacity = 1.0;
    }
    for (const def of this.fpArms.stealthMatDefaults) {
      def.mat.color.setHex(def.baseColor);
      def.mat.emissive.setHex(0x000000);
      def.mat.emissiveIntensity = 0;
      def.mat.opacity = 1.0;
    }
  }

  private createNpcEntity(
    archetype: NpcArchetype,
    name: string,
    route: THREE.Vector3[],
    offsetIdx: number,
    night: number,
    escortTarget: NpcEntity | null = null,
  ): NpcEntity {
    const id = this.nextNpcId++;
    const rig = createNpcModel(archetype, name, this.textures, this.sharedUniforms);
    const startWp = escortTarget ? escortTarget.position.clone().add(new THREE.Vector3(1.5, 0, -1.5)) : route[offsetIdx % route.length];
    const pos = startWp.clone();
    rig.root.position.copy(pos);
    this.scene.add(rig.root);

    const isEliteGuard = name === 'Inquisidor de Prata' || name === 'Alabardeiro';
    const isPatriarch = name === 'Lorde Valerius';
    const isMagistrate = name === 'Magistrado Vance';

    const statusTier: NpcStatusTier = isPatriarch
      ? 'patriarca'
      : archetype === 'hunter'
      ? 'cacador'
      : archetype === 'noble'
      ? 'nobre'
      : archetype === 'bodyguard'
      ? 'escolta'
      : isEliteGuard
      ? 'elite'
      : archetype === 'guard'
      ? 'vigilia'
      : archetype === 'cultist'
      ? 'cultista'
      : archetype === 'beggar'
      ? 'mendigo'
      : 'plebeu';

    const huntPoints =
      isPatriarch || isMagistrate || isEliteGuard || archetype === 'bodyguard' || archetype === 'hunter'
        ? 3
        : archetype === 'noble' || archetype === 'guard' || archetype === 'cultist'
        ? 2
        : 1;

    // Essence rewards scaled directly by social/tactical risk!
    const bloodReward = isPatriarch
      ? 60
      : isMagistrate
      ? 54
      : name === 'Barão Thorne'
      ? 50
      : name === 'Condessa Eleanor'
      ? 48
      : archetype === 'hunter'
      ? 46
      : archetype === 'bodyguard'
      ? 44
      : isEliteGuard
      ? 42
      : name === 'Sentinela Sacra'
      ? 38
      : archetype === 'guard'
      ? 36
      : archetype === 'cultist'
      ? 36
      : archetype === 'beggar'
      ? 18
      : 24;

    const essenceReward = isPatriarch
      ? 78
      : isMagistrate
      ? 66
      : name === 'Barão Thorne'
      ? 58
      : archetype === 'hunter'
      ? 58
      : name === 'Condessa Eleanor'
      ? 54
      : archetype === 'bodyguard'
      ? 56
      : name === 'Inquisidor de Prata'
      ? 48
      : name === 'Alabardeiro'
      ? 46
      : name === 'Sentinela Sacra'
      ? 40
      : archetype === 'guard'
      ? 36
      : archetype === 'cultist'
      ? 34
      : archetype === 'beggar'
      ? 9
      : 16;

    const maxHp =
      archetype === 'bodyguard'
        ? 95 + (night - 1) * 18
        : archetype === 'hunter'
        ? 90 + (night - 1) * 18
        : isEliteGuard
        ? 85 + (night - 1) * 18
        : archetype === 'guard'
        ? 65 + (night - 1) * 15
        : archetype === 'cultist'
        ? 44
        : archetype === 'noble'
        ? 35
        : archetype === 'beggar'
        ? 22
        : 28;

    const baseSpeed =
      archetype === 'hunter'
        ? 2.85 + night * 0.14
        : archetype === 'bodyguard'
        ? 2.75 + night * 0.14
        : archetype === 'guard'
        ? 2.55 + night * 0.15
        : archetype === 'noble'
        ? 2.15
        : archetype === 'cultist'
        ? 2.05
        : archetype === 'beggar'
        ? 1.45
        : 1.95;

    return {
      id,
      archetype,
      statusTier,
      name,
      rig,
      position: pos,
      yaw: 0,
      speed: baseSpeed,
      hp: maxHp,
      maxHp,
      route,
      waypointIndex: (offsetIdx + 1) % route.length,
      state: 'patrol',
      suspicion: 0,
      stateTimer: 0,
      investigateArrived: false,
      restTimer: 0,
      restCooldown: 8 + Math.random() * 10,
      shiftTimer: 0,
      shiftDuration: 32 + Math.random() * 14,
      investigatePos: pos.clone(),
      targetBell: null,
      escortTarget,
      hasBodyguard: false,
      attackWindup: 0,
      attackCooldown: 0,
      attackSwingTimer: 0,
      hitStaggerTimer: 0,
      hitStaggerDuration: 0.4,
      hitRecoilDir: 1,
      deathFallTimer: 0,
      deathFallStartRotX: 0,
      deathFallStartY: 0,
      frameMoveDirX: 0,
      frameMoveDirZ: 0,
      frameMoveSpeed: 0,
      frameIsMoving: false,
      walkPhase: Math.random() * 6.28,
      huntPoints,
      bloodReward,
      essenceReward,
      respawnTimer: 0,
      corpseHidden: false,
      corpseDiscovered: false,
      lastStuckCheckPos: pos.clone(),
      stuckTimer: 0,
      avoidSign: id % 2 === 0 ? 1 : -1,
      steerAngleOffset: 0,
      possessTimer: 0,
      possessPos: pos.clone(),
      boltCooldown: 0.6 + Math.random() * 0.8,
    };
  }

  private spawnNpcsForNight(night: number): void {
    for (const npc of this.npcs) {
      this.scene.remove(npc.rig.root);
    }
    this.npcs = [];
    this.nextNpcId = 1;

    const mainCandidates = ['Lorde Valerius', 'Condessa Eleanor', 'Magistrado Vance', 'Barão Thorne'];
    this.mainTargetName = mainCandidates[(night - 1) % mainCandidates.length];
    this.mainTargetDefeated = false;
    const mainRouteIndexMap: Record<string, number> = {
      'Lorde Valerius': 0,
      'Barão Thorne': 1,
      'Magistrado Vance': 2,
      'Condessa Eleanor': 3,
    };
    const mainRouteIdx = mainRouteIndexMap[this.mainTargetName] ?? 0;

    const archetypeCounts: Record<NpcArchetype, number> = {
      citizen: 0,
      beggar: 0,
      cultist: 0,
      noble: 0,
      guard: 0,
      bodyguard: 0,
      hunter: 0,
    };

    const addNpc = (
      archetype: NpcArchetype,
      route: THREE.Vector3[],
      offsetIdx: number,
      forcedName?: string,
    ) => {
      const names: Record<NpcArchetype, string[]> = {
        citizen: ['Camponês Noturno', 'Ferreiro Tardio', 'Peregrino'],
        beggar: ['Mendigo das Ruas', 'Eremita do Beco', 'Cego do Porto'],
        cultist: ['Acólito do Eclipse', 'Boticário', 'Fanático da Catedral', 'Sacerdote da Névoa'],
        noble: ['Lorde Valerius', 'Condessa Eleanor', 'Barão Thorne', 'Magistrado Vance'],
        guard: ['Caçador da Vigília', 'Inquisidor de Prata', 'Sentinela Sacra', 'Alabardeiro'],
        bodyguard: ['Guarda-Costas Juramentado'],
        hunter: ['Caçador de Vampiros'],
      };
      const nameList = names[archetype];
      const name = forcedName ?? nameList[archetypeCounts[archetype] % nameList.length];
      archetypeCounts[archetype] += 1;

      const npc = this.createNpcEntity(archetype, name, route, offsetIdx, night);
      this.npcs.push(npc);
      return npc;
    };

    this.world.citizenRoutes.forEach((route, idx) => {
      addNpc('citizen', route, idx);
      if (idx % 2 === 0) addNpc('citizen', route, idx + 2);
    });

    this.world.beggarRoutes.forEach((route, idx) => {
      addNpc('beggar', route, idx);
    });

    this.world.cultistRoutes.forEach((route, idx) => {
      addNpc('cultist', route, idx);
    });

    this.world.nobleRoutes.forEach((route, idx) => {
      const isMain = idx === mainRouteIdx;
      const noble = addNpc('noble', route, idx, isMain ? this.mainTargetName : undefined);
      if (isMain) {
        noble.isMainTarget = true;
        noble.essenceReward += 25;
        noble.bloodReward = Math.min(80, noble.bloodReward + 10);
        this.mainTargetDistrict = DISTRICT_META[this.getDistrictAt(noble.position)].name;
      }
      const nobleDist = this.getDistrictAt(noble.position);
      if (this.districtInfamy[nobleDist] >= DISTRICT_META[nobleDist].bodyguardThreshold) {
        this.spawnBodyguardForNoble(noble, false);
      }
      if (idx === 0 || night >= 2) {
        addNpc('noble', route, idx + 2);
      }
    });

    const guardCount = Math.min(this.world.guardRoutes.length + night, 11);
    for (let i = 0; i < guardCount; i++) {
      const route = this.world.guardRoutes[i % this.world.guardRoutes.length];
      addNpc('guard', route, (i * 2) % route.length);
    }

    const hunterCount =
      this.districtInfamy.avenue >= 35 || night >= 2
        ? Math.min(Math.max(1, night - 1 + (this.districtInfamy.avenue >= 65 ? 1 : 0)), this.world.hunterRoutes.length)
        : 0;
    for (let i = 0; i < hunterCount; i++) {
      const route = this.world.hunterRoutes[i % this.world.hunterRoutes.length];
      addNpc('hunter', route, i);
    }
  }

  private spawnBodyguardForNoble(noble: NpcEntity, notify = true): void {
    if (noble.hasBodyguard || noble.state === 'drained') return;
    noble.hasBodyguard = true;
    const guard = this.createNpcEntity(
      'bodyguard',
      'Guarda-Costas Juramentado',
      noble.route,
      noble.waypointIndex,
      this.nightNumber,
      noble,
    );
    this.npcs.push(guard);
    if (notify) {
      const dId = this.getDistrictAt(noble.position);
      this.showBanner(
        `Alta Infâmia em ${DISTRICT_META[dId].name}: ${noble.name} contratou um Guarda-Costas!`,
        3.6,
      );
    }
  }

  private addDistrictInfamy(pos: THREE.Vector3, amount: number): void {
    if (this.isInSafeCemetery(pos)) return;
    const dId = this.getDistrictAt(pos);
    const meta = DISTRICT_META[dId];
    const mult = dId === 'alleys' ? 0.85 : dId === 'cemetery' ? 1.1 : dId === 'avenue' ? 1.15 : 1.0;
    const prev = this.districtInfamy[dId];
    const next = THREE.MathUtils.clamp(prev + amount * mult, 0, 100);
    this.districtInfamy[dId] = next;

    if (prev < meta.bodyguardThreshold && next >= meta.bodyguardThreshold) {
      for (const npc of this.npcs) {
        if (npc.archetype === 'noble' && npc.state !== 'drained' && !npc.hasBodyguard) {
          if (this.getDistrictAt(npc.position) === dId || npc.position.distanceTo(pos) < 34) {
            this.spawnBodyguardForNoble(npc, true);
            break;
          }
        }
      }
    }

    if (prev < 40 && next >= 40 && this.world.hunterRoutes.length > 0) {
      const activeHunters = this.npcs.filter((n) => n.archetype === 'hunter' && n.state !== 'drained').length;
      if (activeHunters < this.world.hunterRoutes.length) {
        const route = this.world.hunterRoutes[activeHunters % this.world.hunterRoutes.length];
        const hunter = this.createNpcEntity('hunter', 'Caçador de Vampiros', route, 0, this.nightNumber);
        this.npcs.push(hunter);
        this.showBanner(
          `Ordem Escarlate mobilizada: um Caçador de Vampiros entrou na Avenida Vitoriana!`,
          3.8,
        );
      }
    }
  }

  private recordHuntLog(npc: NpcEntity, method: string, essenceEarned: number): void {
    const lore =
      IMPORTANT_NPC_LORE.find((entry) => entry.name === npc.name) ??
      (npc.archetype === 'cultist'
        ? IMPORTANT_NPC_LORE.find((entry) => entry.archetype === 'cultist')
        : npc.archetype === 'bodyguard'
        ? IMPORTANT_NPC_LORE.find((entry) => entry.archetype === 'bodyguard')
        : undefined);
    if (!lore) return;

    const dName = DISTRICT_META[this.getDistrictAt(npc.position)].name;
    const newEntry: HuntLogEntry = {
      name: npc.name,
      archetype: npc.archetype,
      title: lore.title,
      districtName: dName,
      nightNumber: this.nightNumber,
      method,
      essenceEarned,
      isMainTarget: Boolean(npc.isMainTarget),
      history: lore.history,
      uniqueBehavior: lore.uniqueBehavior,
    };
    const existingIdx = this.huntLog.findIndex((e) => e.name === npc.name);
    if (existingIdx >= 0) {
      this.huntLog.splice(existingIdx, 1);
    }
    this.huntLog.unshift(newEntry);
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    if (phase !== 'playing' && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.audio.setAmbientFocus(phase === 'playing');
    if (phase === 'playing') {
      this.audio.startAmbient();
      this.clock.getDelta();
    }
    this.pushHudSnapshot(true);
  }

  public startNewHunt(): void {
    this.health = 100;
    this.maxHealth = 100;
    this.blood = 92;
    this.maxBlood = 100;
    this.essence = 35;
    this.pendingEssence = 0;
    this.globalSuspicion = 0;
    this.districtInfamy = {
      cathedral: 0,
      alleys: 0,
      avenue: 0,
      cemetery: 0,
    };
    this.huntLog = [];
    this.isCrouching = false;
    this.isCrimsonSense = false;
    this.crimsonTarget = 0;
    this.nightNumber = 1;
    this.nightTimer = 0;
    this.powerRegenTimer = 0;
    this.dawnWarned = false;
    this.dawnBroken = false;
    this.dawnBurnTickTimer = 0;
    this.dawnBurnAudioCooldown = 0;
    this.quotaNotified = false;
    this.lastNightSummary = null;
    this.killsThisNight = 0;
    this.quotaThisNight = 7;
    this.totalKills = 0;
    this.noblesDrained = 0;
    this.guardsSlain = 0;
    this.collectedMemories = [];
    this.encounteredTargets.clear();
    this.discoveredWeaknesses = {};
    this.weatherIndex = 0;
    this.weather = 'clear';
    this.weatherTimer = 0;
    this.weatherDuration = 22;
    this.weatherVisionMult = 1.0;
    this.weatherNoiseMult = 1.0;
    this.rainIntensity = 0.0;
    this.fogIntensity = 0.0;
    this.unlockedSkills = new Set<string>(INITIAL_UNLOCKED_SKILLS);
    this.equippedPowers = [...DEFAULT_EQUIPPED_POWERS];
    this.syncDisciplinesFromSkills();
    this.cooldowns = {
      shadowDash: 0,
      snuffLamp: 0,
      shadowSnare: 0,
      abyssalShroud: 0,
      darknessPulse: 0,
      obfuscate: 0,
      falseVisage: 0,
      shadowDecoy: 0,
      astralScout: 0,
      dominate: 0,
      memoryWipe: 0,
      possess: 0,
      batSwarm: 0,
      mistForm: 0,
      celerity: 0,
      shadowLeap: 0,
      shadowThrow: 0,
    };
    this.deathReason = null;
    this.clawSlashTimer = 0;
    this.clawSlashDuration = 0.24;
    this.clawComboStep = 0;
    this.clawActiveComboStep = 0;
    this.clawComboResetTimer = 0;
    this.clawCooldown = 0;
    this.feedIsStealth = true;
    this.killSlowMoTimer = 0;
    this.killCamIntensity = 0;
    this.jumpLandAnimTimer = 0;
    this.coyoteTimer = 0;

    this.placeVampireInSanctuary();

    for (const lamp of this.world.lamps) {
      this.setLampLit(lamp, true);
    }
    for (const bell of this.world.bells) {
      this.resetBell(bell);
    }
    for (const prop of this.world.breakables) {
      prop.broken = false;
      prop.group.visible = true;
    }
    for (const mem of this.world.memories) {
      mem.collected = false;
      mem.group.visible = true;
    }

    this.spawnNpcsForNight(1);
    this.updateWeather(10.0, false);
    this.showBanner(
      `Noite I — Cripta Segura (Adro da Catedral). Alvo Principal: ${this.mainTargetName}.`,
      4.5,
    );
    this.audio.startAmbient();
    this.audio.playCathedralBell();
    this.setPhase('playing');
  }

  public advanceNextNight(): void {
    this.nightNumber += 1;
    this.nightTimer = 0;
    this.powerRegenTimer = 0;
    this.dawnWarned = false;
    this.dawnBroken = false;
    this.dawnBurnTickTimer = 0;
    this.dawnBurnAudioCooldown = 0;
    this.quotaNotified = false;
    this.lastNightSummary = null;
    this.pendingEssence = 0;
    this.killsThisNight = 0;
    this.quotaThisNight = 7 + (this.nightNumber - 1) * 3;
    this.weatherIndex = (this.nightNumber - 1) % this.weatherSchedule.length;
    this.weather = this.weatherSchedule[this.weatherIndex];
    this.weatherTimer = 0;
    this.weatherDuration = 36;
    this.updateWeather(10.0, false);
    this.health = Math.min(this.maxHealth, this.health + 35);
    this.blood = Math.min(this.maxBlood, Math.max(this.blood, 75));

    this.placeVampireInSanctuary();

    for (const lamp of this.world.lamps) {
      this.setLampLit(lamp, true);
    }
    for (const bell of this.world.bells) {
      this.resetBell(bell);
    }
    for (const prop of this.world.breakables) {
      prop.broken = false;
      prop.group.visible = true;
    }
    this.spawnNpcsForNight(this.nightNumber);
    this.showBanner(
      `Noite ${this.nightNumber} (${WEATHER_META[this.weather].label}) — Alvo Principal: ${this.mainTargetName}.`,
      4.4,
    );
    this.audio.playCathedralBell();
    this.setPhase('playing');
  }

  private hasSkill(id: string): boolean {
    return this.unlockedSkills.has(id);
  }

  private syncDisciplinesFromSkills(): void {
    const levels: DisciplineLevels = {
      tenebrosidade: 0,
      ofuscacao: 0,
      auspicios: 0,
      dominacao: 0,
      metamorfose: 0,
      rapidez: 0,
    };
    for (const node of ALL_SKILL_NODES) {
      if (node.slot === 'amalgam') continue;
      if (this.unlockedSkills.has(node.id) && node.tierNum > levels[node.discipline]) {
        levels[node.discipline] = node.tierNum;
      }
    }
    this.disciplines = levels;
  }

  public unlockSkillNode(nodeId: string): boolean {
    const node = ALL_SKILL_NODES.find((n) => n.id === nodeId);
    if (!node) return false;
    if (this.unlockedSkills.has(nodeId)) return false;
    if (!isSkillNodeAvailable(node, this.unlockedSkills)) return false;
    if (this.essence < node.cost) return false;

    this.essence -= node.cost;
    this.unlockedSkills.add(nodeId);
    this.syncDisciplinesFromSkills();

    if (
      node.linkedPower &&
      !this.equippedPowers.includes(node.linkedPower) &&
      this.equippedPowers.length < MAX_EQUIPPED_SLOTS
    ) {
      this.equippedPowers.push(node.linkedPower);
    }

    this.audio.playEvolutionUnlock();
    this.showBanner(
      `${node.powerType === 'Amálgama' ? 'Amálgama desperta' : 'Disciplina desperta'}: ${node.name}!`,
      3.2,
    );
    this.pushHudSnapshot(true);
    return true;
  }

  public equipPower(powerId: ActivePowerId): boolean {
    const meta = ACTIVE_POWER_LIST.find((p) => p.id === powerId);
    if (!meta || !this.unlockedSkills.has(meta.requiredNodeId)) return false;
    if (this.equippedPowers.includes(powerId)) return true;
    if (this.equippedPowers.length >= MAX_EQUIPPED_SLOTS) {
      this.showBanner(`Barra cheia (${MAX_EQUIPPED_SLOTS}/${MAX_EQUIPPED_SLOTS}). Desequipe outro poder primeiro.`, 2.4);
      return false;
    }
    this.equippedPowers.push(powerId);
    this.pushHudSnapshot(true);
    return true;
  }

  public unequipPower(powerId: ActivePowerId): boolean {
    const idx = this.equippedPowers.indexOf(powerId);
    if (idx < 0) return false;
    this.equippedPowers.splice(idx, 1);
    this.pushHudSnapshot(true);
    return true;
  }

  public upgradeDiscipline(disciplineId: DisciplineId): boolean {
    const candidates = ALL_SKILL_NODES.filter(
      (n) => n.slot !== 'amalgam' && n.discipline === disciplineId && isSkillNodeAvailable(n, this.unlockedSkills),
    );
    if (candidates.length === 0) return false;
    return this.unlockSkillNode(candidates[0].id);
  }

  public setHotkey(powerId: ActivePowerId, code: string): boolean {
    const reserved = [
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'Space',
      'Escape',
      'Tab',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ShiftLeft',
      'ShiftRight',
      'KeyC',
      'ControlLeft',
      'KeyF',
      'KeyG',
      'KeyX',
    ];
    if (reserved.includes(code)) {
      this.showBanner(`Tecla [${formatKeyCodeLabel(code)}] reservada para controles centrais.`, 2.0);
      return false;
    }

    const prevCode = this.hotkeys[powerId];
    if (prevCode === code) return true;

    // Swap if another power currently owns this key
    for (const meta of ACTIVE_POWER_LIST) {
      if (meta.id !== powerId && this.hotkeys[meta.id] === code) {
        this.hotkeys[meta.id] = prevCode;
      }
    }
    this.hotkeys[powerId] = code;
    const powerMeta = ACTIVE_POWER_LIST.find((p) => p.id === powerId);
    if (powerMeta) {
      this.showBanner(`${powerMeta.name} vinculado à tecla [${formatKeyCodeLabel(code)}].`, 2.2);
    }
    this.pushHudSnapshot(true);
    return true;
  }

  public toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  public isMuted(): boolean {
    return this.audio.isMuted();
  }

  private showBanner(text: string, duration = 3.0): void {
    this.statusBanner = text;
    this.statusBannerTimer = duration;
  }

  private addGlobalSuspicion(amount: number): void {
    const prevTier = this.getSuspicionTier();
    this.globalSuspicion = THREE.MathUtils.clamp(this.globalSuspicion + amount, 0, 100);
    const nextTier = this.getSuspicionTier();
    if (nextTier !== prevTier && amount > 0) {
      this.showBanner(`Suspeita Global: ${nextTier} — Patrulhas mais agressivas!`, 3.0);
    }
  }

  private getSuspicionTier(): SuspicionTier {
    if (this.globalSuspicion >= 75) return 'Lei Marcial';
    if (this.globalSuspicion >= 50) return 'Caça Ativa';
    if (this.globalSuspicion >= 25) return 'Inquietação';
    return 'Silencioso';
  }

  private registerEncounter(npc: NpcEntity, notify = false): void {
    if (npc.archetype === 'citizen') return;
    if (!this.encounteredTargets.has(npc.name)) {
      this.encounteredTargets.add(npc.name);
      if (notify) {
        this.showBanner(`Alvo registrado no Grimório: ${npc.name}`, 2.4);
      }
    }
  }

  private discoverWeakness(targetName: string, weaknessId: string): void {
    const profile = NPC_DOSSIER_PROFILES.find((p) => p.name === targetName);
    if (!profile) return;
    const weakness = profile.weaknesses.find((w) => w.id === weaknessId);
    if (!weakness) return;

    this.encounteredTargets.add(targetName);
    if (!this.discoveredWeaknesses[targetName]) {
      this.discoveredWeaknesses[targetName] = new Set<string>();
    }
    if (!this.discoveredWeaknesses[targetName].has(weaknessId)) {
      this.discoveredWeaknesses[targetName].add(weaknessId);
      this.showBanner(
        `Fraqueza descoberta: ${targetName} — ${weakness.label} (Grimório [Tab])`,
        3.2,
      );
      this.pushHudSnapshot(true);
    }
  }

  private updateWeather(dt: number, advanceCycle: boolean): void {
    if (advanceCycle) {
      this.weatherTimer += dt;
      if (this.weatherTimer >= this.weatherDuration) {
        this.weatherTimer = 0;
        this.weatherIndex = (this.weatherIndex + 1) % this.weatherSchedule.length;
        this.weather = this.weatherSchedule[this.weatherIndex];
        this.weatherDuration = 36 + Math.random() * 14;
        this.showBanner(WEATHER_META[this.weather].banner, 3.8);
        this.pushHudSnapshot(true);
      }
    }

    const targetFogDensity =
      this.weather === 'fog' ? 0.042 : this.weather === 'rain' ? 0.025 : 0.0175;
    const targetVisionMult =
      this.weather === 'fog' ? 0.62 : this.weather === 'rain' ? 0.88 : 1.0;
    const targetNoiseMult =
      this.weather === 'rain' ? 0.42 : this.weather === 'fog' ? 0.9 : 1.0;
    const targetRain = this.weather === 'rain' ? 1.0 : 0.0;
    const targetFog = this.weather === 'fog' ? 1.0 : 0.0;

    this.sceneFog.density = THREE.MathUtils.damp(this.sceneFog.density, targetFogDensity, 1.1, dt);
    this.weatherVisionMult = THREE.MathUtils.damp(this.weatherVisionMult, targetVisionMult, 1.5, dt);
    this.weatherNoiseMult = THREE.MathUtils.damp(this.weatherNoiseMult, targetNoiseMult, 1.5, dt);
    this.rainIntensity = THREE.MathUtils.damp(this.rainIntensity, targetRain, 1.6, dt);
    this.fogIntensity = THREE.MathUtils.damp(this.fogIntensity, targetFog, 1.4, dt);

    // Progressive Night (00:00) -> Pre-Dawn Twilight -> Crimson-Amber Aurora (05:00)
    const nightProgress = Math.min(1, this.nightTimer / Math.max(1, this.nightDuration));
    const preDawnT = THREE.MathUtils.smoothstep(nightProgress, 0.60, 0.84);
    const dawnBreakT = THREE.MathUtils.smoothstep(nightProgress, 0.80, 0.96);
    const sunriseT = THREE.MathUtils.smoothstep(nightProgress, 0.94, 1.0);
    const dawnAmount = THREE.MathUtils.clamp(preDawnT * 0.25 + dawnBreakT * 0.55 + sunriseT * 0.35, 0, 1);

    const targetBgHex =
      this.weather === 'fog' ? 0x070a18 : this.weather === 'rain' ? 0x020309 : 0x03050d;
    _color.setHex(targetBgHex);
    _color.lerp(_color2.setHex(0x1b1429), preDawnT * 0.85);
    _color.lerp(_color2.setHex(0x5c262a), dawnBreakT * 0.85);
    _color.lerp(_color2.setHex(0x9e5942), sunriseT * 0.9);
    this.fogColor.lerp(_color, Math.min(1, dt * 1.8));
    this.sceneFog.color.copy(this.fogColor);

    // Sync sky dome zenith, horizon & eastern dawn glow
    _skyZenithTarget.setHex(this.weather === 'fog' ? 0x050712 : 0x020308);
    _skyZenithTarget.lerp(_color3.setHex(0x111a36), preDawnT);
    _skyZenithTarget.lerp(_color3.setHex(0x2d3f6b), dawnBreakT * 0.85 + sunriseT * 0.15);
    this.skyUniforms.uZenithColor.value.lerp(_skyZenithTarget, Math.min(1, dt * 1.8));
    this.skyUniforms.uHorizonColor.value.copy(this.fogColor);

    _dawnGlowTarget.setHex(0x4c1d3d);
    _dawnGlowTarget.lerp(_color3.setHex(0xc2410c), dawnBreakT);
    _dawnGlowTarget.lerp(_color3.setHex(0xfbbf24), sunriseT * 0.7);
    this.skyUniforms.uDawnGlowColor.value.lerp(_dawnGlowTarget, Math.min(1, dt * 1.8));
    this.skyUniforms.uDawnAmount.value = THREE.MathUtils.damp(
      this.skyUniforms.uDawnAmount.value,
      dawnAmount,
      1.8,
      dt,
    );
    this.skyUniforms.uTime.value = this.sharedUniforms.uTime.value;

    // Directional Moon -> Low Eastern Dawn Sun
    const baseMoonIntensity =
      this.weather === 'fog' ? 0.32 : this.weather === 'rain' ? 0.38 : 0.48;
    const targetDirIntensity = THREE.MathUtils.lerp(baseMoonIntensity, 1.75, dawnBreakT * 0.65 + sunriseT * 0.35);
    this.moonLight.intensity = THREE.MathUtils.damp(this.moonLight.intensity, targetDirIntensity, 1.6, dt);

    _color.setHex(0x6b88cc);
    _color.lerp(_color2.setHex(0xf49d6b), dawnBreakT);
    _color.lerp(_color2.setHex(0xffcf88), sunriseT);
    this.moonLight.color.lerp(_color, Math.min(1, dt * 1.8));
    this.moonLight.position.lerpVectors(_sunStartPos, _sunDawnPos, dawnBreakT * 0.75 + sunriseT * 0.25);

    // Ambient Hemisphere & Rim fill
    const baseHemi =
      this.weather === 'fog' ? 0.24 : this.weather === 'rain' ? 0.15 : 0.18;
    const targetHemi = THREE.MathUtils.lerp(baseHemi, 0.82, preDawnT * 0.25 + dawnBreakT * 0.5 + sunriseT * 0.25);
    this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, targetHemi, 1.6, dt);
    _color.setHex(0x1c2852).lerp(_color2.setHex(0x9e635b), dawnBreakT * 0.75 + sunriseT * 0.25);
    this.hemiLight.color.lerp(_color, Math.min(1, dt * 1.8));
    _color.setHex(0x04050c).lerp(_color2.setHex(0x261a1e), dawnBreakT * 0.8 + sunriseT * 0.2);
    this.hemiLight.groundColor.lerp(_color, Math.min(1, dt * 1.8));

    _color.setHex(0x3b4899).lerp(_color2.setHex(0xf59e6b), dawnBreakT * 0.8 + sunriseT * 0.2);
    this.rimLight.color.lerp(_color, Math.min(1, dt * 1.8));
    this.rimLight.intensity = THREE.MathUtils.damp(
      this.rimLight.intensity,
      THREE.MathUtils.lerp(0.15, 0.34, dawnBreakT * 0.7 + sunriseT * 0.3),
      1.6,
      dt,
    );

    const targetEnv = THREE.MathUtils.lerp(0.24, 0.68, preDawnT * 0.25 + dawnBreakT * 0.45 + sunriseT * 0.3);
    this.scene.environmentIntensity = THREE.MathUtils.damp(this.scene.environmentIntensity, targetEnv, 1.6, dt);
    const targetExposure = THREE.MathUtils.lerp(1.02, 1.14, dawnBreakT * 0.6 + sunriseT * 0.4);
    this.renderer.toneMappingExposure = THREE.MathUtils.damp(this.renderer.toneMappingExposure, targetExposure, 1.5, dt);

    // Matte rough cobblestones with subtle sheen reserved exclusively for isolated puddles
    const targetCobbleRough = THREE.MathUtils.lerp(0.96, 0.91, this.rainIntensity);
    this.mats.cobble.roughness = THREE.MathUtils.damp(this.mats.cobble.roughness, targetCobbleRough, 1.5, dt);
    const targetPuddleRough = THREE.MathUtils.lerp(0.11, 0.04, this.rainIntensity);
    this.mats.puddle.roughness = THREE.MathUtils.damp(this.mats.puddle.roughness, targetPuddleRough, 1.5, dt);
    const targetPuddleOpacity = THREE.MathUtils.lerp(0.72, 0.9, this.rainIntensity);
    this.mats.puddle.opacity = THREE.MathUtils.damp(this.mats.puddle.opacity, targetPuddleOpacity, 1.5, dt);

    this.audio.updateWeatherAmbience(this.rainIntensity, this.fogIntensity);
    this.updateRain(dt);
  }

  private updateRain(dt: number): void {
    if (this.rainIntensity < 0.03) {
      this.rainMesh.visible = false;
      return;
    }
    this.rainMesh.visible = true;
    this.rainMat.opacity = 0.42 * this.rainIntensity;

    const windDriftX = this.sharedUniforms.uWindDir.value.x * this.windStrength * 3.4;
    const windDriftZ = this.sharedUniforms.uWindDir.value.y * this.windStrength * 3.4;
    const cx = this.playerPos.x;
    const cz = this.playerPos.z;
    const baseY = this.playerPos.y;

    for (let i = 0; i < this.rainCount; i++) {
      const drop = this.rainDrops[i];
      drop.y -= drop.speed * dt;
      drop.x += windDriftX * dt;
      drop.z += windDriftZ * dt;

      if (drop.y < baseY - 1.5) {
        drop.y = baseY + 16 + Math.random() * 6;
        drop.x = cx + (Math.random() - 0.5) * 44;
        drop.z = cz + (Math.random() - 0.5) * 44;
      } else {
        if (drop.x < cx - 22) drop.x += 44;
        else if (drop.x > cx + 22) drop.x -= 44;
        if (drop.z < cz - 22) drop.z += 44;
        else if (drop.z > cz + 22) drop.z -= 44;
      }

      _dummy.position.set(drop.x, drop.y, drop.z);
      _dummy.rotation.set(windDriftZ * 0.035, 0, -windDriftX * 0.035);
      _dummy.scale.set(1, 0.8 + this.rainIntensity * 0.45, 1);
      _dummy.updateMatrix();
      this.rainMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.rainMesh.instanceMatrix.needsUpdate = true;
  }

  private resetBell(bell: AlarmBellInstance): void {
    bell.sabotaged = false;
    bell.ringTimer = 0;
    bell.cooldown = 0;
    bell.ropeMesh.visible = true;
    bell.bellPivot.rotation.z = 0;
    bell.beaconMat.color.setHex(0xf59e0b);
  }

  private triggerAlarmBell(bell: AlarmBellInstance): void {
    if (bell.sabotaged || bell.cooldown > 0) return;
    bell.ringTimer = 3.2;
    bell.cooldown = 20.0;
    bell.beaconMat.color.setHex(0xef4444);
    this.audio.playAlarmBell();
    this.shakeIntensity = 0.28;
    this.addGlobalSuspicion(24);
    this.showBanner(`${bell.name} soou! Caçadores convergindo!`, 3.4);

    // Alert all guards & hunters within 34m and spike district Infamy!
    this.addDistrictInfamy(bell.position, 22);
    for (const npc of this.npcs) {
      const isGuardTier =
        npc.archetype === 'guard' || npc.archetype === 'bodyguard' || npc.archetype === 'hunter';
      if (isGuardTier && npc.state !== 'drained' && npc.state !== 'stunned') {
        if (npc.position.distanceTo(bell.position) <= 34 || npc.position.distanceTo(this.playerPos) <= 28) {
          npc.state = 'hunt';
          npc.suspicion = 1;
          npc.stateTimer = 11.5;
          npc.investigatePos.copy(this.playerPos);
          npc.targetBell = null;
        }
      }
    }
  }

  private setLampLit(lamp: StreetLampInstance, lit: boolean): void {
    lamp.isLit = lit;
    lamp.pointLight.intensity = lit ? 28 : 0;
    lamp.flameMesh.visible = lit;
    lamp.poolMesh.visible = lit;
    lamp.lightConeMesh.visible = lit;
    if (!lit) {
      const susReduction = this.globalSuspicion >= 50 ? 0.65 : 1.0;
      lamp.extinguishTimer = (22 + (this.hasSkill('ten_3') ? 8 : 0)) * susReduction;

      // Only NPCs within 12m with unobstructed line of sight to the lamp notice it go dark
      // and walk over to inspect the extinguished post without auto-detecting the player
      let closestNoticeDist = Infinity;
      let anyInvestigated = false;
      for (const npc of this.npcs) {
        if (
          npc.state !== 'drained' &&
          npc.state !== 'stunned' &&
          npc.state !== 'possessed' &&
          npc.state !== 'alert' &&
          npc.state !== 'hunt' &&
          npc.state !== 'flee' &&
          npc !== this.feedTarget
        ) {
          const isGuardTier =
            npc.archetype === 'guard' || npc.archetype === 'bodyguard' || npc.archetype === 'hunter';
          const d = Math.hypot(npc.position.x - lamp.position.x, npc.position.z - lamp.position.z);
          if (
            d <= 12.0 &&
            Math.abs(npc.position.y - lamp.position.y) < 4.5 &&
            hasLineOfSight(npc.position, lamp.position, this.world.volumes)
          ) {
            if (d < closestNoticeDist) closestNoticeDist = d;
            _v1.subVectors(lamp.position, npc.position);
            npc.yaw = Math.atan2(_v1.x, _v1.z);
            npc.state = 'curious';
            npc.restTimer = 0;
            npc.investigateArrived = false;
            npc.suspicion = Math.max(npc.suspicion, isGuardTier ? 0.35 : 0.22);
            npc.stateTimer = 7.5;
            npc.investigatePos.copy(lamp.position);
            anyInvestigated = true;
          }
        }
      }
      if (anyInvestigated && this.phase === 'playing') {
        this.audio.playSuspicionCue('curious');
      }
      if (closestNoticeDist <= 12.0 && this.phase === 'playing') {
        this.showBanner('Alguém avistou o lampião apagado e foi investigar!', 2.3);
      }
    } else {
      lamp.extinguishTimer = 0;
    }
  }

  private emitDarkSmoke(origin: THREE.Vector3, count = 8, spread = 0.65): void {
    let spawned = 0;
    let colorDirty = false;
    for (let i = 0; i < this.smokePuffs.length && spawned < count; i++) {
      const puff = this.smokePuffs[i];
      if (!puff.active) {
        puff.active = true;
        puff.isDark = true;
        puff.pos.set(
          origin.x + (Math.random() - 0.5) * spread,
          origin.y + Math.random() * 0.45,
          origin.z + (Math.random() - 0.5) * spread,
        );
        puff.vel.set(
          (Math.random() - 0.5) * 1.4,
          1.25 + Math.random() * 0.9,
          (Math.random() - 0.5) * 1.4,
        );
        puff.life = 0;
        puff.maxLife = 1.25 + Math.random() * 0.65;
        puff.baseScale = 0.72 + Math.random() * 0.42;
        this.smokeMesh.setColorAt(i, _color.setHex(0x090b16));
        colorDirty = true;
        spawned++;
      }
    }
    if (colorDirty && this.smokeMesh.instanceColor) {
      this.smokeMesh.instanceColor.needsUpdate = true;
    }
    this.emitParticles(origin, Math.max(6, count), 0x16192c, 3.2, 0.65, 1.35, 1.15);
  }

  private reportSupernaturalWitness(
    powerLabel: string,
    radius: number,
    infamyAmt: number,
    suspicionAmt: number,
    ignoreTargets: NpcEntity[] = [],
  ): void {
    let firstWitness: NpcEntity | null = null;
    for (const npc of this.npcs) {
      if (
        npc.state === 'drained' ||
        npc.state === 'stunned' ||
        npc.state === 'possessed' ||
        npc === this.feedTarget ||
        ignoreTargets.includes(npc)
      ) {
        continue;
      }
      const horizDist = Math.hypot(npc.position.x - this.playerPos.x, npc.position.z - this.playerPos.z);
      const vertDiff = Math.abs(npc.position.y - this.playerPos.y);
      if (horizDist > radius || vertDiff > 5.5) continue;

      if (hasLineOfSight(npc.position, this.playerPos, this.world.volumes)) {
        if (!firstWitness) firstWitness = npc;
        npc.restTimer = 0;
        npc.investigatePos.copy(this.playerPos);
        if (npc.archetype === 'guard' || npc.archetype === 'bodyguard' || npc.archetype === 'hunter') {
          npc.suspicion = Math.max(npc.suspicion, 0.85);
          npc.state = 'alert';
          npc.stateTimer = 8.0;
        } else if (npc.archetype === 'cultist') {
          npc.suspicion = Math.max(npc.suspicion, 0.75);
          npc.state = 'curious';
          npc.stateTimer = 6.5;
        } else {
          npc.state = 'flee';
          npc.stateTimer = 7.0;
          if (npc.archetype !== 'beggar') {
            npc.targetBell = this.findNearestActiveBell(npc.position, 24);
          }
        }
      }
    }

    if (firstWitness) {
      this.addDistrictInfamy(this.playerPos, infamyAmt);
      this.addGlobalSuspicion(suspicionAmt);
      this.showBanner(`${firstWitness.name} testemunhou ${powerLabel}! (+Infâmia)`, 2.8);
    }
  }

  private emitParticles(
    origin: THREE.Vector3,
    count: number,
    colorHex: number,
    speed: number,
    life: number,
    gravity = -4.5,
    scale = 1.0,
    homingToVampire = false,
  ): void {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.homingToVampire = homingToVampire;
        p.pos.copy(origin);
        p.pos.x += (Math.random() - 0.5) * (homingToVampire ? 0.18 : 0.4);
        p.pos.y += (Math.random() - 0.3) * (homingToVampire ? 0.18 : 0.4);
        p.pos.z += (Math.random() - 0.5) * (homingToVampire ? 0.18 : 0.4);
        const a = Math.random() * Math.PI * 2;
        const up = Math.random() * speed * 0.7;
        p.vel.set(
          Math.cos(a) * speed * (0.4 + Math.random() * 0.7),
          up,
          Math.sin(a) * speed * (0.4 + Math.random() * 0.7),
        );
        p.life = life * (0.7 + Math.random() * 0.6);
        p.maxLife = p.life;
        p.scale = scale;
        p.color.setHex(colorHex);
        // Bright blood & arcane sparks exceed 1.0 luminance to subtly trigger selective bloom
        if (
          colorHex === 0xef4444 ||
          colorHex === 0xdc2626 ||
          colorHex === 0xc026d3 ||
          colorHex === 0x818cf8 ||
          colorHex === 0xff9c3b ||
          colorHex === 0xfbbf24 ||
          colorHex === 0x38bdf8
        ) {
          p.color.multiplyScalar(1.65);
        }
        p.gravity = gravity;
        spawned++;
      }
    }
  }

  private emitSoundEvent(
    origin: THREE.Vector3,
    radius: number,
    intensity: number,
    colorHex = 0x94b8ff,
  ): void {
    this.noisePulse = Math.max(this.noisePulse, THREE.MathUtils.clamp(intensity, 0, 100));

    // Spawn visual ground ripple ring
    for (let i = 0; i < this.soundRipples.length; i++) {
      const r = this.soundRipples[i];
      if (!r.active) {
        r.active = true;
        r.life = 0;
        r.maxLife = intensity >= 70 ? 0.85 : 0.55;
        r.maxRadius = Math.min(radius * 0.42, 6.5);
        r.mesh.position.set(origin.x, origin.y + 0.06, origin.z);
        r.mesh.scale.setScalar(0.35);
        r.mesh.visible = true;
        r.mat.color.setHex(colorHex);
        r.mat.opacity = intensity >= 70 ? 0.65 : 0.36;
        break;
      }
    }

    // Notify Guards, Hunters, Cultists, Nobles & Citizens to investigate nearby sound sources
    for (const npc of this.npcs) {
      if (
        npc.state === 'drained' ||
        npc.state === 'stunned' ||
        npc.state === 'possessed' ||
        npc.state === 'alert' ||
        npc.state === 'hunt' ||
        npc.state === 'flee'
      ) {
        continue;
      }
      if (npc === this.feedTarget) continue;

      const horizDist = Math.hypot(origin.x - npc.position.x, origin.z - npc.position.z);
      const vertDiff = Math.abs(origin.y - npc.position.y);
      if (vertDiff > 5.5) continue;

      // Walls muffle sound propagation by ~32%; beggars are less attentive to distant noise
      const occluded = !hasLineOfSight(npc.position, origin, this.world.volumes);
      let effectiveRadius = occluded ? radius * 0.68 : radius;
      if (npc.archetype === 'beggar') effectiveRadius *= 0.55;

      if (horizDist <= effectiveRadius) {
        const proximityFactor = 1 - horizDist / Math.max(1, effectiveRadius);
        const susBoost = (intensity / 100) * (0.35 + proximityFactor * 0.45);
        const prevState = npc.state;
        npc.restTimer = 0;
        npc.investigateArrived = false;
        npc.investigatePos.copy(origin);
        if (npc.archetype === 'guard' || npc.archetype === 'bodyguard' || npc.archetype === 'hunter') {
          npc.suspicion = Math.max(npc.suspicion, Math.min(0.88, 0.22 + susBoost));
          npc.state = npc.suspicion >= 0.55 ? 'suspicious' : 'curious';
          npc.stateTimer = intensity >= 70 ? 7.5 : 5.8;
          if (npc.archetype === 'hunter') this.discoverWeakness(npc.name, 'hunter_lure');
        } else {
          npc.state = 'curious';
          npc.stateTimer = 5.4;
          npc.suspicion = Math.max(npc.suspicion, 0.42);
        }
        if (prevState !== npc.state && this.phase === 'playing') {
          this.audio.playSuspicionCue(npc.state === 'suspicious' ? 'suspicious' : 'curious');
        }
      }
    }
  }

  private breakProp(prop: BreakablePropInstance): void {
    if (prop.broken) return;
    prop.broken = true;
    prop.group.visible = false;
    this.audio.playPropBreak(prop.kind);
    this.shakeIntensity = Math.max(this.shakeIntensity, 0.16);

    const shardColor = prop.kind === 'barrel' ? 0x8b5a2b : 0xcbd5e1;
    const shardOrigin = prop.position.clone().setY(prop.position.y + 0.55);
    this.emitParticles(shardOrigin, 18, shardColor, 4.8, 0.55, -7.5, 1.05);

    this.emitSoundEvent(prop.position, 17.5, 95, 0xfbbf24);
  }

  private handleResize(): void {
    if (this.destroyed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const pixelRatio = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(pixelRatio);
    this.composer?.setPixelRatio(this.isSoftwareGl ? 1 : PS2_INTERNAL_SCALE);
    this.composer?.setSize(w, h);
    this.bloomPass?.resolution.set(Math.max(256, w), Math.max(256, h));
    if (this.shadowPass) {
      this.shadowPass.uniforms.uResolution.value.set(
        Math.max(360, Math.round(w * 0.5)),
        Math.max(240, Math.round(h * 0.5)),
      );
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const code = e.code;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      if (this.phase === 'playing' || this.phase === 'grimoire') {
        e.preventDefault();
      }
    }

    if (code === 'Escape') {
      if (this.phase === 'playing') {
        this.callbacks.onPhaseRequest('paused');
        this.setPhase('paused');
      } else if (this.phase === 'paused' || this.phase === 'grimoire') {
        this.callbacks.onPhaseRequest('playing');
        this.setPhase('playing');
      }
      return;
    }

    if (code === 'Tab') {
      if (this.phase === 'playing') {
        this.callbacks.onPhaseRequest('grimoire');
        this.setPhase('grimoire');
      } else if (this.phase === 'grimoire') {
        this.callbacks.onPhaseRequest('playing');
        this.setPhase('playing');
      }
      return;
    }

    if (this.phase !== 'playing') return;

    this.audio.startAmbient();
    if (!this.heldKeys.has(code)) {
      this.justPressed.add(code);
    }
    this.heldKeys.add(code);

    if (code === 'KeyC' || code === 'ControlLeft') {
      this.isCrouching = !this.isCrouching;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.heldKeys.delete(e.code);
  }

  private handleMouseDown(e: MouseEvent): void {
    if (this.phase !== 'playing') return;
    this.audio.startAmbient();
    if (e.button === 0) {
      if (this.pointerLocked) {
        // When pointer-locked, left click triggers Claw Strike!
        this.justPressed.add('ClawAttack');
      } else {
        this.isDraggingCamera = true;
        try {
          this.renderer.domElement.requestPointerLock?.();
        } catch {
          // Optional pointer lock fallback
        }
      }
    } else if (e.button === 2) {
      this.isDraggingCamera = true;
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.phase !== 'playing') return;
    if (this.pointerLocked || this.isDraggingCamera) {
      if (this.astralActive) {
        this.astralYaw -= e.movementX * 0.0042;
        this.astralPitch = THREE.MathUtils.clamp(this.astralPitch + e.movementY * 0.0032, -0.65, 0.85);
      } else {
        this.camYaw -= e.movementX * 0.0028;
        this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.0024, -1.24, 1.32);
      }
    }
  }

  private startLoop(): void {
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        this.frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (this.destroyed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.destroyed) return;
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      if (this.isSoftwareGl || !this.composer) {
        this.renderer.render(this.scene, this.camera);
      } else {
        this.composer.render();
      }

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private update(realDt: number): void {
    // High-priority stealth kill slow-motion time scaling
    let slowMoScale = 1.0;
    if (this.phase === 'playing' && this.killSlowMoTimer > 0) {
      this.killSlowMoTimer = Math.max(0, this.killSlowMoTimer - realDt);
      const easeOut = this.killSlowMoTimer < 0.35 ? 1.0 - this.killSlowMoTimer / 0.35 : 0.0;
      slowMoScale = THREE.MathUtils.lerp(0.26, 1.0, easeOut * easeOut);
    }
    const dt = realDt * slowMoScale;
    const killCamTarget = this.phase === 'playing' && this.killSlowMoTimer > 0.12 ? 1.0 : 0.0;
    this.killCamIntensity = THREE.MathUtils.damp(this.killCamIntensity, killCamTarget, 10.0, realDt);

    this.sharedUniforms.uTime.value += dt;
    const t = this.sharedUniforms.uTime.value;

    // Dynamic Nocturnal Wind Simulation (slowly rotating gusts affecting banners, curtains & smoke)
    this.windAngle = 0.55 + Math.sin(t * 0.11) * 0.65 + Math.cos(t * 0.04) * 0.35;
    const gust = 0.58 + Math.sin(t * 0.38) * 0.24 + Math.max(0, Math.sin(t * 0.17 + 1.2)) * 0.38;
    this.windStrength = THREE.MathUtils.damp(this.windStrength, gust, 2.2, dt);
    this.sharedUniforms.uWindDir.value.set(Math.cos(this.windAngle), Math.sin(this.windAngle));
    this.sharedUniforms.uWindStrength.value = this.windStrength;
    this.audio.updateWindAmbience(this.windStrength);
    if (this.phase === 'playing') {
      this.audio.tickAmbientAtmosphere(dt, this.isNearSafeSanctuary(this.playerPos), this.windStrength);
    }
    this.updateWeather(dt, this.phase === 'playing');
    this.updateSmoke(dt);
    this.updateAmbientMotes(dt);

    // Animate uncollected Memory Fragments
    for (let i = 0; i < this.world.memories.length; i++) {
      const m = this.world.memories[i];
      if (!m.collected) {
        m.crystalPivot.rotation.y = t * 1.6 + i;
        m.crystalPivot.position.y = 0.92 + Math.sin(t * 2.8 + i) * 0.1;
      }
    }

    const crystal = this.world.altarGroup.getObjectByName('altarCrystal');
    const ring = this.world.altarGroup.getObjectByName('altarRing');
    if (crystal) {
      crystal.rotation.y = t * 1.4;
      crystal.position.y = 2.25 + Math.sin(t * 2.5) * 0.12;
    }
    if (ring) {
      ring.rotation.z = t * 0.9;
      ring.rotation.x = Math.PI / 3 + Math.sin(t * 1.2) * 0.25;
    }

    for (let i = 0; i < this.ambientBats.length; i++) {
      const b = this.ambientBats[i];
      const ang = t * (0.45 + (i % 3) * 0.12) + i * 0.8;
      const rad = 14 + (i % 4) * 4;
      b.position.x = Math.cos(ang) * rad;
      b.position.z = -38 + Math.sin(ang) * rad;
      b.position.y = 21 + Math.sin(t * 3 + i) * 1.5;
      b.rotation.y = -ang;
    }

    this.sharedUniforms.uCrimsonSense.value = THREE.MathUtils.damp(
      this.sharedUniforms.uCrimsonSense.value,
      this.crimsonTarget,
      7.0,
      realDt,
    );

    if (this.phase === 'title') {
      this.vampire.bodyPivot.visible = true;
      this.vampire.contactShadow.visible = true;
      this.fpArms.root.visible = false;
      this.shadowImmersion = THREE.MathUtils.damp(this.shadowImmersion, 0, 6.0, realDt);
      this.audio.updateWhisperAmbience(0, 0);
      if (this.shadowPass) {
        this.shadowPass.uniforms.uTime.value = t;
        this.shadowPass.uniforms.uShadowDepth.value = this.shadowImmersion;
        this.shadowPass.uniforms.uCrimsonSense.value = this.sharedUniforms.uCrimsonSense.value;
        this.shadowPass.uniforms.uKillCam.value = 0;
      }
      this.titleAngle += realDt * 0.14;
      const r = 34;
      this.camera.rotation.order = 'XYZ';
      this.camera.position.set(
        Math.sin(this.titleAngle) * r,
        16 + Math.sin(this.titleAngle * 0.7) * 2.5,
        -12 + Math.cos(this.titleAngle) * r,
      );
      this.camera.lookAt(0, 6.5, -24);
      this.updateParticles(dt);
      this.updateSoundRipples(dt);
      this.justPressed.clear();
      return;
    }

    if (this.phase !== 'playing') {
      if (this.phase === 'gameover' || this.phase === 'victory') {
        this.fpArms.root.visible = false;
      }
      this.shadowImmersion = THREE.MathUtils.damp(this.shadowImmersion, 0, 6.0, realDt);
      this.audio.updateWhisperAmbience(0, 0);
      if (this.shadowPass) {
        this.shadowPass.uniforms.uTime.value = t;
        this.shadowPass.uniforms.uShadowDepth.value = this.shadowImmersion;
        this.shadowPass.uniforms.uCrimsonSense.value = this.sharedUniforms.uCrimsonSense.value;
        this.shadowPass.uniforms.uKillCam.value = 0;
      }
      this.updateParticles(dt);
      this.updateSoundRipples(dt);
      this.justPressed.clear();
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= realDt;
      this.updateCamera(realDt);
      this.updateParticles(dt);
      this.justPressed.clear();
      return;
    }

    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= realDt;
      if (this.statusBannerTimer <= 0) this.statusBanner = null;
    }

    this.nightTimer += dt;
    this.powerRegenTimer = Math.max(0, this.powerRegenTimer - dt);
    const cdDt = dt * (this.powerRegenTimer > 0 ? 2.0 : 1.0);

    this.cooldowns.shadowDash = Math.max(0, this.cooldowns.shadowDash - cdDt);
    this.cooldowns.snuffLamp = Math.max(0, this.cooldowns.snuffLamp - cdDt);
    this.cooldowns.shadowSnare = Math.max(0, this.cooldowns.shadowSnare - cdDt);
    this.cooldowns.abyssalShroud = Math.max(0, this.cooldowns.abyssalShroud - cdDt);
    this.cooldowns.darknessPulse = Math.max(0, this.cooldowns.darknessPulse - cdDt);
    this.cooldowns.obfuscate = Math.max(0, this.cooldowns.obfuscate - cdDt);
    this.cooldowns.falseVisage = Math.max(0, this.cooldowns.falseVisage - cdDt);
    this.cooldowns.shadowDecoy = Math.max(0, this.cooldowns.shadowDecoy - cdDt);
    this.cooldowns.astralScout = Math.max(0, this.cooldowns.astralScout - cdDt);
    this.cooldowns.dominate = Math.max(0, this.cooldowns.dominate - cdDt);
    this.cooldowns.memoryWipe = Math.max(0, this.cooldowns.memoryWipe - cdDt);
    this.cooldowns.possess = Math.max(0, this.cooldowns.possess - cdDt);
    this.cooldowns.batSwarm = Math.max(0, this.cooldowns.batSwarm - cdDt);
    this.cooldowns.mistForm = Math.max(0, this.cooldowns.mistForm - cdDt);
    this.cooldowns.celerity = Math.max(0, this.cooldowns.celerity - cdDt);
    this.cooldowns.shadowLeap = Math.max(0, this.cooldowns.shadowLeap - cdDt);
    this.cooldowns.shadowThrow = Math.max(0, this.cooldowns.shadowThrow - cdDt);

    this.shadowVeilTimer = Math.max(0, this.shadowVeilTimer - dt);
    this.abyssalShroudTimer = Math.max(0, this.abyssalShroudTimer - dt);
    this.batFormTimer = Math.max(0, this.batFormTimer - dt);
    this.mistFormTimer = Math.max(0, this.mistFormTimer - dt);
    this.obfuscateTimer = Math.max(0, this.obfuscateTimer - dt);
    this.falseVisageTimer = Math.max(0, this.falseVisageTimer - dt);
    this.celerityTimer = Math.max(0, this.celerityTimer - dt);
    this.castAnimTimer = Math.max(0, this.castAnimTimer - dt);
    this.clawSlashTimer = Math.max(0, this.clawSlashTimer - dt);
    this.clawComboResetTimer = Math.max(0, this.clawComboResetTimer - dt);
    this.clawCooldown = Math.max(0, this.clawCooldown - dt);
    this.jumpLandAnimTimer = Math.max(0, this.jumpLandAnimTimer - dt);

    // Update active Shadow Decoy (Simulacro Sombrio) lure & visuals
    if (this.shadowDecoyTimer > 0) {
      this.shadowDecoyTimer = Math.max(0, this.shadowDecoyTimer - dt);
      if (this.shadowDecoyTimer <= 0) {
        this.shadowDecoyGroup.visible = false;
      } else {
        this.shadowDecoyGroup.visible = true;
        this.shadowDecoyGroup.position.set(
          this.shadowDecoyPos.x,
          this.shadowDecoyPos.y + Math.sin(t * 4.2) * 0.08,
          this.shadowDecoyPos.z,
        );
        this.shadowDecoyGroup.rotation.y += dt * 1.4;
        const fadeOut = Math.min(1, this.shadowDecoyTimer / 0.9);
        this.shadowDecoyBodyMat.opacity = (0.48 + Math.sin(t * 7.5) * 0.14) * fadeOut;
        this.shadowDecoyRingMat.opacity = (0.42 + Math.cos(t * 5.0) * 0.12) * fadeOut;
        if (Math.random() < 0.14) {
          this.emitDarkSmoke(this.shadowDecoyPos.clone().setY(this.shadowDecoyPos.y + 0.75), 1, 0.38);
        }
        this.shadowDecoyPulseTimer -= dt;
        if (this.shadowDecoyPulseTimer <= 0) {
          this.shadowDecoyPulseTimer = 1.25;
          this.lureNpcsToDecoy(false);
        }
      }
    }

    // Update expanding Darkness Pulse shockwave ring
    if (this.darknessPulseTimer > 0) {
      this.darknessPulseTimer = Math.max(0, this.darknessPulseTimer - realDt);
      const pProg = 1 - this.darknessPulseTimer / this.darknessPulseMax;
      const rad = 1.2 + pProg * 12.2;
      this.darknessPulseRing.scale.setScalar(rad);
      this.darknessPulseMat.opacity = (1 - pProg) * 0.72;
      if (this.darknessPulseTimer <= 0) {
        this.darknessPulseRing.visible = false;
      }
    }

    for (const lamp of this.world.lamps) {
      if (lamp.isLit) {
        lamp.pointLight.intensity = 36.5 + Math.sin(t * 7 + lamp.id) * 2.2;
      } else if (lamp.extinguishTimer > 0) {
        lamp.extinguishTimer -= dt;
        if (lamp.extinguishTimer <= 0) {
          this.setLampLit(lamp, true);
        }
      }
    }

    // Update Alarm Bell swing & cooldowns
    for (const bell of this.world.bells) {
      bell.cooldown = Math.max(0, bell.cooldown - dt);
      if (bell.ringTimer > 0) {
        bell.ringTimer -= dt;
        bell.bellPivot.rotation.z = Math.sin(t * 22) * 0.48 * Math.min(1, bell.ringTimer);
        if (bell.ringTimer <= 0 && !bell.sabotaged) {
          bell.bellPivot.rotation.z = 0;
          bell.beaconMat.color.setHex(0xf59e0b);
        }
      }
    }

    this.updatePlayer(dt, realDt);
    this.updateProjectiles(dt);
    this.updateNpcs(dt);

    // Smoothly widen FOV during Celerity or Astral Scout for crisp first-person sense of speed
    const targetFov = this.astralActive ? 68 : this.celerityTimer > 0 ? 75 : 66;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 8, realDt);
      this.camera.updateProjectionMatrix();
    }

    // Compute Deep Shadow Immersion factor (0..1) for post-processing & high-contrast HUD
    const crouchActive = this.isCrouching || this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');
    const veiled =
      this.dashTimer > 0 ||
      this.shadowVeilTimer > 0 ||
      this.abyssalShroudTimer > 0 ||
      this.batFormTimer > 0 ||
      this.mistFormTimer > 0 ||
      this.obfuscateTimer > 0;
    let shadowTarget = 0;
    if (veiled) {
      shadowTarget = 1.0;
    } else if (this.exposure < 32) {
      shadowTarget = THREE.MathUtils.clamp((32 - this.exposure) / 24, 0.15, 1.0);
      if (crouchActive) shadowTarget = Math.min(1.0, shadowTarget + 0.15);
    }
    this.shadowImmersion = THREE.MathUtils.damp(this.shadowImmersion, shadowTarget, 5.5, realDt);
    if (this.shadowPass) {
      this.shadowPass.uniforms.uTime.value = t + realDt * 0.35;
      this.shadowPass.uniforms.uShadowDepth.value = this.shadowImmersion;
      this.shadowPass.uniforms.uCrimsonSense.value = this.sharedUniforms.uCrimsonSense.value;
      this.shadowPass.uniforms.uKillCam.value = this.killCamIntensity;
    }

    // Slow Global Suspicion & Regional Infamy decay when quiet in each district; rapid respite in Safe Cemetery
    const playerInSafeCemetery = this.isInSafeCemetery(this.playerPos);
    if (playerInSafeCemetery) {
      if (this.globalSuspicion > 0) {
        this.globalSuspicion = Math.max(0, this.globalSuspicion - 5.5 * dt);
      }
      if (this.districtInfamy.cemetery > 0) {
        this.districtInfamy.cemetery = Math.max(0, this.districtInfamy.cemetery - 3.8 * dt);
      }
    }
    const anyAlert = this.npcs.some((n) => n.state === 'alert' || n.state === 'hunt');
    if (!anyAlert && this.exposure < 35 && this.globalSuspicion > 0) {
      this.globalSuspicion = Math.max(0, this.globalSuspicion - 0.55 * dt);
    }
    (Object.keys(this.districtInfamy) as DistrictId[]).forEach((dId) => {
      if (this.districtInfamy[dId] <= 0) return;
      const activeInDistrict = this.npcs.some(
        (n) =>
          (n.state === 'alert' || n.state === 'hunt') && this.getDistrictAt(n.position) === dId,
      );
      if (!activeInDistrict) {
        this.districtInfamy[dId] = Math.max(
          0,
          this.districtInfamy[dId] - 0.7 * DISTRICT_META[dId].decayMult * dt,
        );
      }
    });

    // Dynamic Psychological Whisper Ambience (high-suspicion districts + key NPC proximity)
    const curDistrict = this.getDistrictAt(this.playerPos);
    const suspicionTension = THREE.MathUtils.clamp(
      Math.max(this.globalSuspicion / 100, this.districtInfamy[curDistrict] / 100),
      0,
      1,
    );
    let npcProximityTension = 0;
    for (const npc of this.npcs) {
      if (npc.state === 'drained') continue;
      if (
        npc.archetype === 'guard' ||
        npc.archetype === 'bodyguard' ||
        npc.archetype === 'hunter' ||
        npc.archetype === 'noble' ||
        npc.archetype === 'cultist'
      ) {
        const d = Math.hypot(npc.position.x - this.playerPos.x, npc.position.z - this.playerPos.z);
        if (d < 16) {
          let prox = 1 - d / 16;
          if (npc.archetype === 'cultist' || npc.archetype === 'bodyguard' || npc.archetype === 'hunter') {
            prox = Math.min(1, prox * 1.25);
          }
          if (npc.state === 'hunt' || npc.state === 'alert') prox = Math.min(1, prox + 0.35);
          if (prox > npcProximityTension) npcProximityTension = prox;
        }
      }
    }
    this.audio.updateWhisperAmbience(suspicionTension, npcProximityTension);

    // Occultist/Apothecary Blood Power Regeneration Buff
    if (this.powerRegenTimer > 0) {
      this.blood = Math.min(this.maxBlood, this.blood + 2.6 * dt);
    }

    // Blood drains through active toggled vampiric powers; 0 blood never hurts vitality!
    if (this.isCrimsonSense) {
      const senseDrain = this.hasSkill('aus_2a') ? 1.1 : 1.8;
      this.blood = Math.max(0, this.blood - senseDrain * dt);
      if (this.blood <= 0) {
        this.isCrimsonSense = false;
        this.crimsonTarget = 0;
        this.audio.playCrimsonSense(false);
        this.showBanner('Sangue esgotado — Sentido Carmesim desativado.', 2.2);
      }
    }

    if (this.astralActive) {
      this.blood = Math.max(0, this.blood - 1.4 * dt);
      if (this.blood <= 0) {
        this.astralActive = false;
        this.astralOrb.visible = false;
        this.audio.playAstralScout(false);
        this.showBanner('Sangue esgotado — Projeção Astral encerrada.', 2.2);
      }
    }

    // Night Clock -> Dawn Warning (>= 04:15) & Sunlight Burn Outside Crypt (>= 05:00)
    const nightProg = this.nightTimer / Math.max(1, this.nightDuration);
    if (nightProg >= 0.85 && !this.dawnWarned) {
      this.dawnWarned = true;
      this.audio.playDawnWarning();
      this.showBanner('04:15 — A alvorada se aproxima! Retorne à Cripta no Adro da Catedral.', 4.6);
    }
    if (nightProg >= 1.0) {
      if (!this.dawnBroken) {
        this.dawnBroken = true;
        this.audio.playDawnWarning();
        this.showBanner('05:00 — Aurora! A luz solar queima fora da Cripta!', 4.8);
      }
      if (!this.isNearSafeSanctuary(this.playerPos)) {
        this.health -= 5.8 * dt;
        this.dawnBurnTickTimer -= dt;
        this.dawnBurnAudioCooldown -= dt;
        if (this.dawnBurnTickTimer <= 0) {
          this.dawnBurnTickTimer = 0.28;
          this.emitParticles(this.playerPos.clone().setY(this.playerPos.y + 1.1), 3, 0xfbbf24, 2.2, 0.45, 0.6, 0.9);
        }
        if (this.dawnBurnAudioCooldown <= 0) {
          this.dawnBurnAudioCooldown = 0.95;
          this.audio.playDawnBurnTick();
        }
        if (this.health <= 0) {
          this.triggerGameOver('Reduzido a cinzas pela luz implacável da alvorada nas ruas de Ravencroft.');
          return;
        }
      }
    }

    // Night quota unlocks Crypt Coffin rest rather than ending immediately
    if (this.killsThisNight >= this.quotaThisNight && !this.quotaNotified) {
      this.quotaNotified = true;
      this.audio.playCathedralBell();
      this.showBanner(
        'Cota noturna cumprida! Retorne à Cripta no Adro da Catedral Norte e repouse no caixão [E].',
        4.8,
      );
    }

    this.updateCamera(realDt);
    this.updateParticles(dt);
    this.updateSoundRipples(dt);
    this.justPressed.clear();

    if (realDt > 0 && performance.now() - this.lastHudPush > 65) {
      this.lastHudPush = performance.now();
      this.pushHudSnapshot(false);
    }
  }

  private lureNpcsToDecoy(playCue: boolean): void {
    let playedCue = !playCue;
    for (const npc of this.npcs) {
      if (
        npc.state === 'drained' ||
        npc.state === 'stunned' ||
        npc.state === 'possessed' ||
        npc.state === 'alert' ||
        npc.state === 'hunt' ||
        npc.state === 'flee' ||
        npc === this.feedTarget
      ) {
        continue;
      }
      const d = Math.hypot(npc.position.x - this.shadowDecoyPos.x, npc.position.z - this.shadowDecoyPos.z);
      if (d <= 16.5 && Math.abs(npc.position.y - this.shadowDecoyPos.y) <= 5.0) {
        const prev = npc.state;
        npc.restTimer = 0;
        npc.investigateArrived = false;
        npc.investigatePos.copy(this.shadowDecoyPos);
        npc.state = 'curious';
        npc.stateTimer = Math.max(npc.stateTimer, 4.8);
        npc.suspicion = Math.max(npc.suspicion, 0.35);
        if (!playedCue && (prev === 'patrol' || prev === 'resting')) {
          playedCue = true;
          this.audio.playSuspicionCue('curious');
        }
      }
    }
  }

  private canUsePower(powerId: ActivePowerId): boolean {
    const meta = ACTIVE_POWER_LIST.find((p) => p.id === powerId);
    if (!meta) return false;
    return this.hasSkill(meta.requiredNodeId) && this.equippedPowers.includes(powerId);
  }

  private getSkillCooldownMax(id: Exclude<ActivePowerId, 'crimsonSense'>): number {
    switch (id) {
      case 'shadowDash': {
        let cd = this.hasSkill('ten_3') ? 3.0 : 4.5;
        if (this.hasSkill('amal_umbra_blade')) cd *= 0.75;
        return cd;
      }
      case 'snuffLamp':
        return this.hasSkill('ten_3') ? 5.0 : 7.0;
      case 'shadowSnare':
        return 9.0;
      case 'abyssalShroud':
        return 16.0;
      case 'darknessPulse':
        return this.hasSkill('ten_3') ? 13.0 : 16.0;
      case 'obfuscate':
        return this.hasSkill('ofu_3') ? 10.5 : 13.0;
      case 'falseVisage':
        return this.hasSkill('ofu_3') ? 12.5 : 15.0;
      case 'shadowDecoy':
        return this.hasSkill('ofu_3') ? 11.5 : 14.0;
      case 'astralScout':
        return 2.0;
      case 'dominate':
        return this.hasSkill('dom_3') ? 9.8 : 13.0;
      case 'memoryWipe':
        return this.hasSkill('dom_3') ? 10.5 : 14.0;
      case 'possess':
        return this.hasSkill('dom_3') ? 11.2 : 15.0;
      case 'batSwarm':
        return this.hasSkill('met_3') ? 8.5 : 12.0;
      case 'mistForm':
        return this.hasSkill('met_3') ? 12.0 : 15.0;
      case 'celerity':
        return this.hasSkill('rap_3') ? 11.0 : 14.0;
      case 'shadowLeap':
        return this.hasSkill('amal_nightmare') ? 3.6 : 5.5;
      case 'shadowThrow':
        return 5.0;
    }
  }

  private spawnProjectile(
    isEnemyBolt: boolean,
    origin: THREE.Vector3,
    vel: THREE.Vector3,
    life = 1.6,
  ): void {
    for (const p of this.projectiles) {
      if (!p.active) {
        p.active = true;
        p.isEnemyBolt = isEnemyBolt;
        p.pos.copy(origin);
        p.vel.copy(vel);
        p.life = life;
        p.mesh.position.copy(origin);
        _v1.copy(origin).add(vel);
        p.mesh.lookAt(_v1);
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(isEnemyBolt ? 0xfbbf24 : 0xa855f7);
        p.mesh.visible = true;
        return;
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      // Wall/building collision
      let hitWall = false;
      for (let i = 0; i < this.world.volumes.length; i++) {
        const v = this.world.volumes[i];
        if (!v.blocksSight) continue;
        if (
          p.pos.x >= v.minX &&
          p.pos.x <= v.maxX &&
          p.pos.y >= v.minY &&
          p.pos.y <= v.maxY &&
          p.pos.z >= v.minZ &&
          p.pos.z <= v.maxZ
        ) {
          hitWall = true;
          break;
        }
      }
      if (hitWall || p.pos.y < 0.05) {
        p.active = false;
        p.mesh.visible = false;
        this.emitParticles(p.pos, 7, p.isEnemyBolt ? 0xfbbf24 : 0xa855f7, 3.0, 0.35, -3, 0.8);
        if (!p.isEnemyBolt) {
          this.emitSoundEvent(p.pos, 11.5, 68, 0xa855f7);
        }
        continue;
      }

      if (p.isEnemyBolt) {
        const playerDist = Math.hypot(p.pos.x - this.playerPos.x, p.pos.z - this.playerPos.z);
        if (
          playerDist < 0.68 &&
          p.pos.y >= this.playerPos.y + 0.1 &&
          p.pos.y <= this.playerPos.y + 1.85
        ) {
          p.active = false;
          p.mesh.visible = false;
          if (this.mistFormTimer > 0 || this.dashTimer > 0) {
            this.emitParticles(p.pos, 8, 0x94a3b8, 2.5, 0.35, 0, 0.8);
            continue;
          }
          if (this.astralActive) {
            this.astralActive = false;
            this.astralOrb.visible = false;
            this.audio.playAstralScout(false);
          }
          const dmg = 18 + (this.nightNumber - 1) * 4;
          this.health -= dmg;
          this.hitstopTimer = 0.045;
          this.shakeIntensity = 0.32;
          this.audio.playPlayerHit();
          this.emitParticles(
            this.playerPos.clone().setY(this.playerPos.y + 1.2),
            12,
            0xfbbf24,
            4.5,
            0.4,
            -3,
            1.0,
          );
          if (this.health <= 0) {
            this.triggerGameOver('Perfura­do pelo virote de prata de um Caçador de Vampiros.');
            return;
          }
        }
      } else {
        // Player Shadow Throw: smash breakables, snuff lamps, or stun/snare NPCs
        let consumed = false;
        for (const prop of this.world.breakables) {
          if (prop.broken) continue;
          if (
            Math.hypot(p.pos.x - prop.position.x, p.pos.z - prop.position.z) < 0.9 &&
            Math.abs(p.pos.y - (prop.position.y + 0.5)) < 1.1
          ) {
            this.breakProp(prop);
            consumed = true;
            break;
          }
        }
        if (!consumed) {
          for (const lamp of this.world.lamps) {
            if (!lamp.isLit) continue;
            if (
              Math.hypot(p.pos.x - lamp.position.x, p.pos.z - lamp.position.z) < 1.2 &&
              Math.abs(p.pos.y - 4.4) < 1.8
            ) {
              this.setLampLit(lamp, false);
              this.emitDarkSmoke(lamp.position.clone().setY(4.45), 8, 0.7);
              this.audio.playSnuffLamp();
              consumed = true;
              break;
            }
          }
        }
        if (!consumed) {
          for (const npc of this.npcs) {
            if (npc.state === 'drained') continue;
            if (
              Math.hypot(p.pos.x - npc.position.x, p.pos.z - npc.position.z) < 0.85 &&
              p.pos.y >= npc.position.y &&
              p.pos.y <= npc.position.y + 1.9
            ) {
              npc.state = 'stunned';
              npc.stateTimer = this.hasSkill('amal_umbra_blade') ? 3.2 : 2.2;
              npc.suspicion = 0;
              npc.hitStaggerTimer = 0.35;
              npc.hitStaggerDuration = 0.35;
              npc.hitRecoilDir = 1;
              this.emitParticles(
                npc.position.clone().setY(npc.position.y + 1.3),
                14,
                0xa855f7,
                4.2,
                0.45,
                -2,
                1.0,
              );
              if (this.hasSkill('amal_umbra_blade')) {
                this.emitDarkSmoke(npc.position.clone().setY(npc.position.y + 0.8), 7, 0.65);
              }
              if (npc.archetype === 'hunter') this.discoverWeakness(npc.name, 'hunter_lure');
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          p.active = false;
          p.mesh.visible = false;
        }
      }
    }
  }

  private tryLedgeMantle(manualInput: boolean): boolean {
    if (this.isGrounded || this.playerVelY < -8.0) return false;
    // Do not interrupt rising jumps on small props/stairs unless Space was pressed mid-air
    if (!manualInput && this.playerVelY > 2.2) return false;

    const fwdX = Math.sin(this.playerYaw);
    const fwdZ = Math.cos(this.playerYaw);
    const probeX = this.playerPos.x + fwdX * 0.9;
    const probeZ = this.playerPos.z + fwdZ * 0.9;
    const minSurfaceY = manualInput ? 1.3 : 2.1;

    for (let i = 0; i < this.world.volumes.length; i++) {
      const v = this.world.volumes[i];
      if (!v.walkableTop || v.maxY < minSurfaceY) continue;
      if (
        probeX >= v.minX - 0.25 &&
        probeX <= v.maxX + 0.25 &&
        probeZ >= v.minZ - 0.25 &&
        probeZ <= v.maxZ + 0.25
      ) {
        const heightDiff = v.maxY - this.playerPos.y;
        if (heightDiff > 0.45 && heightDiff <= 2.15) {
          this.playerPos.x = THREE.MathUtils.clamp(probeX, v.minX + 0.35, v.maxX - 0.35);
          this.playerPos.z = THREE.MathUtils.clamp(probeZ, v.minZ + 0.35, v.maxZ - 0.35);
          this.playerPos.y = v.maxY;
          this.playerVelY = 0;
          this.isGrounded = true;
          this.jumpLandAnimTimer = 0.14;
          this.audio.playFootstep(true);
          return true;
        }
      }
    }
    return false;
  }

  private isPositionInShadow(pos: THREE.Vector3): boolean {
    for (const lamp of this.world.lamps) {
      if (!lamp.isLit) continue;
      if (Math.hypot(pos.x - lamp.position.x, pos.z - lamp.position.z) < 7.8 && pos.y < 4.5) {
        return false;
      }
    }
    return true;
  }

  private performClawAttack(): void {
    if (this.clawComboResetTimer <= 0) {
      this.clawComboStep = 0;
    }
    const step = this.clawComboStep;
    this.clawActiveComboStep = step;
    this.clawComboStep = (step + 1) % 3;
    this.clawComboResetTimer = 0.95;

    const isFinisher = step === 2;
    const fast = this.celerityTimer > 0;
    this.clawSlashDuration = isFinisher ? (fast ? 0.22 : 0.3) : fast ? 0.18 : 0.24;
    this.clawSlashTimer = this.clawSlashDuration;
    this.clawCooldown = isFinisher ? (fast ? 0.26 : 0.44) : fast ? 0.2 : 0.34;
    this.audio.playClawSlash();

    // Face camera look direction slightly & lunge forward
    const camFwdX = -Math.sin(this.camYaw);
    const camFwdZ = -Math.cos(this.camYaw);
    if (
      !this.heldKeys.has('KeyW') &&
      !this.heldKeys.has('KeyS') &&
      !this.heldKeys.has('KeyA') &&
      !this.heldKeys.has('KeyD')
    ) {
      this.playerYaw = Math.atan2(camFwdX, camFwdZ);
    }

    const dirX = Math.sin(this.playerYaw);
    const dirZ = Math.cos(this.playerYaw);
    const lungeDist = isFinisher ? 0.72 : 0.44;
    this.playerPos.x += dirX * lungeDist;
    this.playerPos.z += dirZ * lungeDist;

    // Crimson claw arc particles
    _v1.set(this.playerPos.x + dirX * 1.1, this.playerPos.y + 1.25, this.playerPos.z + dirZ * 1.1);
    this.emitParticles(_v1, isFinisher ? 16 : 10, 0xef4444, isFinisher ? 4.8 : 3.8, 0.28, 0.0, 0.85);

    const damage =
      (24 + (this.hasSkill('met_1') ? 9 : 0)) *
      (this.celerityTimer > 0 && this.hasSkill('rap_3') ? 1.2 : 1.0) *
      (isFinisher ? 1.18 : 1.0);
    let hitAny = false;

    for (const npc of this.npcs) {
      if (npc.state === 'drained') continue;
      const dx = npc.position.x - this.playerPos.x;
      const dz = npc.position.z - this.playerPos.z;
      const dist = Math.hypot(dx, dz);
      const dy = Math.abs(npc.position.y - this.playerPos.y);
      if (dist > (isFinisher ? 3.35 : 3.1) || dy > 1.8) continue;

      const dot = dist > 0.01 ? (dx / dist) * dirX + (dz / dist) * dirZ : 1;
      if (dot < 0.1) continue;

      hitAny = true;
      this.registerEncounter(npc);
      npc.hp -= damage;
      npc.hitStaggerTimer = isFinisher ? 0.48 : 0.4;
      npc.hitStaggerDuration = npc.hitStaggerTimer;
      npc.hitRecoilDir = step === 1 ? -1 : 1;
      npc.attackWindup = 0;

      // Knockback
      if (dist > 0.01) {
        const kb = isFinisher ? 1.1 : 0.85;
        npc.position.x += (dx / dist) * kb;
        npc.position.z += (dz / dist) * kb;
        resolveHorizontal3D(npc.position, 0.45, this.world.volumes, this.world.playableBounds);
      }

      this.emitParticles(npc.position.clone().setY(npc.position.y + 1.2), 14, 0xdc2626, 4.5, 0.4, -3.5, 1.0);

      const isGuardTier =
        npc.archetype === 'guard' || npc.archetype === 'bodyguard' || npc.archetype === 'hunter';
      if (npc.hp > 0 && isGuardTier && npc.hp <= 25) {
        this.discoverWeakness(npc.name, 'claw_finish');
      }

      if (npc.hp <= 0) {
        // Slay NPC in combat
        npc.state = 'drained';
        npc.rig.hpBarGroup.visible = false;
        npc.rig.alertSpriteMesh.visible = false;
        if (npc.rig.visionCone) npc.rig.visionCone.visible = false;
        npc.corpseHidden = this.isPositionInShadow(npc.position);
        npc.corpseDiscovered = false;
        npc.respawnTimer = 20;
        if (npc.archetype === 'bodyguard' && npc.escortTarget) {
          npc.escortTarget.hasBodyguard = false;
        }

        if (npc.corpseHidden) {
          npc.rig.root.visible = false;
          npc.deathFallTimer = 0;
        } else {
          npc.deathFallStartRotX = npc.rig.bodyGroup.rotation.x;
          npc.deathFallStartY = npc.rig.bodyGroup.position.y;
          npc.deathFallTimer = 0.45;
        }

        // Melee combat kills NEVER count toward stealth night hunt quota and generate much higher Infamy
        this.totalKills += 1;
        if (isGuardTier) this.guardsSlain += 1;
        if (npc.isMainTarget) this.mainTargetDefeated = true;
        const clawEssence = 3;
        this.pendingEssence += clawEssence;
        this.recordHuntLog(npc, 'Abate por Garras (Combate)', clawEssence);
        const meleeInfamyMap: Record<NpcArchetype, number> = {
          beggar: 12,
          citizen: 18,
          cultist: 22,
          guard: 26,
          bodyguard: 30,
          hunter: 30,
          noble: 36,
        };
        const combatInfamy = meleeInfamyMap[npc.archetype];
        this.addDistrictInfamy(npc.position, combatInfamy);
        this.addGlobalSuspicion(8);
        this.showBanner(
          `${npc.name} morto em combate · +${combatInfamy} Infâmia (apenas drenagens furtivas contam na cota)`,
          2.6,
        );
      } else {
        // Alert guard / hunter / cultist on hit
        if (isGuardTier) {
          npc.state = npc.archetype === 'bodyguard' || npc.archetype === 'hunter' ? 'hunt' : 'alert';
          npc.suspicion = 1;
          npc.stateTimer = 9.5;
          npc.investigatePos.copy(this.playerPos);
        } else if (npc.archetype === 'cultist') {
          npc.state = 'alert';
          npc.suspicion = 1;
          npc.stateTimer = 6.5;
          npc.investigatePos.copy(this.playerPos);
        } else {
          npc.state = 'flee';
          npc.stateTimer = 6.0;
        }
      }
    }

    // Smash breakable barrels/urns in front arc
    for (const prop of this.world.breakables) {
      if (prop.broken) continue;
      const dx = prop.position.x - this.playerPos.x;
      const dz = prop.position.z - this.playerPos.z;
      const dist = Math.hypot(dx, dz);
      const dy = Math.abs(prop.position.y - this.playerPos.y);
      if (dist <= 2.75 && dy <= 1.6) {
        const dot = dist > 0.01 ? (dx / dist) * dirX + (dz / dist) * dirZ : 1;
        if (dot >= 0.05) {
          this.breakProp(prop);
        }
      }
    }

    if (hitAny) {
      this.hitstopTimer = 0.042;
      this.shakeIntensity = 0.24;
      this.audio.playClawHit();
    }
    this.emitSoundEvent(this.playerPos, hitAny ? 12.5 : 8.5, hitAny ? 76 : 58, 0xf87171);
  }

  private updatePlayer(dt: number, realDt: number): void {
    if (this.justPressed.has(this.hotkeys.crimsonSense) && this.canUsePower('crimsonSense')) {
      if (!this.isCrimsonSense && this.blood < 4) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.isCrimsonSense = !this.isCrimsonSense;
        this.crimsonTarget = this.isCrimsonSense ? 1.0 : 0.0;
        this.audio.playCrimsonSense(this.isCrimsonSense);
      }
    }

    // Disciplina Auspícios Nv.2B: Projeção Astral (toggle free-flying reconnaissance orb)
    if (
      this.justPressed.has(this.hotkeys.astralScout) &&
      this.canUsePower('astralScout') &&
      this.feedTimer <= 0
    ) {
      if (this.astralActive) {
        this.astralActive = false;
        this.astralOrb.visible = false;
        this.audio.playAstralScout(false);
        this.showBanner('Projeção Astral recolhida.', 1.8);
      } else if (this.cooldowns.astralScout <= 0) {
        const astralCost = Math.max(4, 10 - (this.hasSkill('amal_oracle') ? 4 : 0));
        if (this.blood < astralCost) {
          this.showBanner('Sangue insuficiente.', 1.8);
        } else {
          this.blood -= astralCost;
          this.cooldowns.astralScout = this.getSkillCooldownMax('astralScout');
          this.astralActive = true;
          this.astralPos.set(this.playerPos.x, this.playerPos.y + 3.2, this.playerPos.z);
          this.astralYaw = this.camYaw;
          this.astralPitch = 0.22;
          this.astralOrb.position.copy(this.astralPos);
          this.astralOrb.visible = true;
          this.audio.playAstralScout(true);
          this.showBanner('Projeção Astral ativa — Explore até 45m pelos telhados.', 2.6);
        }
      }
    }

    if (this.astralActive) {
      if (this.heldKeys.has('ArrowLeft')) this.astralYaw += realDt * 2.1;
      if (this.heldKeys.has('ArrowRight')) this.astralYaw -= realDt * 2.1;
      let fwd = 0;
      let right = 0;
      let up = 0;
      if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) fwd += 1;
      if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) fwd -= 1;
      if (this.heldKeys.has('KeyD')) right += 1;
      if (this.heldKeys.has('KeyA')) right -= 1;
      if (this.heldKeys.has('Space')) up += 1;
      if (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('KeyC')) up -= 1;

      if (fwd !== 0 || right !== 0 || up !== 0) {
        const sinY = Math.sin(this.astralYaw);
        const cosY = Math.cos(this.astralYaw);
        _v1.set(-sinY * fwd + cosY * right, up * 0.75, -cosY * fwd - sinY * right);
        if (_v1.lengthSq() > 0.001) {
          _v1.normalize();
          this.astralPos.addScaledVector(_v1, 16.5 * realDt);
        }
      }
      const dx = this.astralPos.x - this.playerPos.x;
      const dz = this.astralPos.z - this.playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 45) {
        this.astralPos.x = this.playerPos.x + (dx / dist) * 45;
        this.astralPos.z = this.playerPos.z + (dz / dist) * 45;
      }
      this.astralPos.y = THREE.MathUtils.clamp(this.astralPos.y, 0.8, 28);
      this.astralOrb.position.copy(this.astralPos);
      this.astralOrb.rotation.y += realDt * 3.5;
      return;
    }

    if (this.heldKeys.has('ArrowLeft')) this.camYaw += realDt * 2.1;
    if (this.heldKeys.has('ArrowRight')) this.camYaw -= realDt * 2.1;

    const crouchActive = this.isCrouching || this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');

    // Currently locked in Smooth Target-Specific "Kiss" Feeding Cinematic
    if (this.feedTimer > 0 && this.feedTarget) {
      const feedTick = this.killSlowMoTimer > 0 ? Math.max(dt, realDt * 0.82) : dt;
      this.feedTimer = Math.max(0, this.feedTimer - feedTick);
      const prog = THREE.MathUtils.clamp(1 - this.feedTimer / Math.max(0.05, this.feedDuration), 0, 1);

      // Smooth positional & rotational glide into the vampire kiss (no instant teleport snap)
      this.playerPos.x = THREE.MathUtils.damp(this.playerPos.x, this.feedDesiredPos.x, 14, realDt);
      this.playerPos.y = THREE.MathUtils.damp(this.playerPos.y, this.feedTarget.position.y, 14, realDt);
      this.playerPos.z = THREE.MathUtils.damp(this.playerPos.z, this.feedDesiredPos.z, 14, realDt);

      _v1.subVectors(this.feedTarget.position, this.playerPos);
      const desiredYaw = Math.atan2(_v1.x, _v1.z);
      let yawDiff = desiredYaw - this.playerYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      this.playerYaw += yawDiff * Math.min(1, realDt * 15);

      const desiredCamYaw = Math.atan2(-_v1.x, -_v1.z);
      let camYawDiff = desiredCamYaw - this.camYaw;
      while (camYawDiff > Math.PI) camYawDiff -= Math.PI * 2;
      while (camYawDiff < -Math.PI) camYawDiff += Math.PI * 2;
      this.camYaw += camYawDiff * Math.min(1, realDt * 12);
      this.camPitch = THREE.MathUtils.damp(this.camPitch, 0.14, 10, realDt);

      this.vampire.root.position.copy(this.playerPos);
      this.vampire.root.rotation.y = this.playerYaw;

      // Ease in (0..0.24) -> Target-specific Bite/Kiss -> Smooth Release (0.88..1.0)
      const inBlend = THREE.MathUtils.smoothstep(prog, 0, 0.24);
      const outBlend = prog > 0.88 ? 1 - THREE.MathUtils.smoothstep(prog, 0.88, 1.0) : 1;
      const poseWeight = inBlend * outBlend;
      const kissPulse = Math.sin(prog * Math.PI * 6) * 0.035;

      let targetDropY = -0.04;
      let targetBodyX = 0.08;
      let targetSpineX = 0.26;
      let targetSpineY = 0;
      let targetHeadX = 0.18;
      let targetHeadZ = 0;
      let targetLArmX = -1.15;
      let targetRArmX = -1.15;
      let targetLArmZ = -0.22;
      let targetRArmZ = 0.22;
      let targetLForeX = -0.65;
      let targetRForeX = -0.65;
      let targetCapeX = 0.28;

      if (this.feedTakedownKind === 'guard') {
        // Rear chokehold & forceful shoulder lock before sinking fangs into the neck
        targetDropY = -0.06;
        targetBodyX = 0.1;
        targetSpineX = 0.34 + kissPulse;
        targetSpineY = 0.08;
        targetHeadX = 0.26;
        targetHeadZ = -0.18;
        targetLArmX = -1.48;
        targetRArmX = -1.08;
        targetLArmZ = -0.08;
        targetRArmZ = 0.16;
        targetLForeX = -0.95;
        targetRForeX = -0.82;
        targetCapeX = 0.42;
      } else if (this.feedTakedownKind === 'noble') {
        // Aristocratic hypnotic waltz embrace: cradling shoulder & drawing victim into the Kiss
        targetDropY = 0;
        targetBodyX = 0.05;
        targetSpineX = 0.22 + kissPulse * 0.8;
        targetSpineY = -0.06;
        targetHeadX = 0.2;
        targetHeadZ = 0.18;
        targetLArmX = -0.92;
        targetRArmX = -1.32;
        targetLArmZ = -0.12;
        targetRArmZ = 0.08;
        targetLForeX = -0.58;
        targetRForeX = -0.88;
        targetCapeX = 0.34;
      } else if (this.feedTakedownKind === 'cultist') {
        // Swift cloak-sweep flank takedown interrupting ritual stance
        targetDropY = -0.1;
        targetBodyX = 0.14;
        targetSpineX = 0.4 + kissPulse;
        targetSpineY = -0.16;
        targetHeadX = 0.24;
        targetHeadZ = -0.14;
        targetLArmX = 0.35;
        targetRArmX = -1.36;
        targetLArmZ = -0.28;
        targetRArmZ = 0.12;
        targetLForeX = -0.4;
        targetRForeX = -0.85;
        targetCapeX = 0.68;
      } else if (this.feedTakedownKind === 'aerial') {
        // Predatory aerial drop crouch clamping onto the prey's shoulders
        targetDropY = -0.22 * (1 - prog * 0.55);
        targetBodyX = 0.18;
        targetSpineX = 0.38 + kissPulse;
        targetHeadX = 0.28;
        targetLArmX = -1.38;
        targetRArmX = -1.38;
        targetLArmZ = -0.3;
        targetRArmZ = 0.3;
        targetLForeX = -0.78;
        targetRForeX = -0.78;
        targetCapeX = 0.88;
      } else {
        // Hushed rear embrace easing mortal softly downward
        targetDropY = -0.09 * prog;
        targetBodyX = 0.08;
        targetSpineX = 0.26 + kissPulse;
        targetHeadX = 0.18;
        targetHeadZ = 0.12;
        targetLArmX = -1.12;
        targetRArmX = -1.12;
        targetLArmZ = -0.18;
        targetRArmZ = 0.18;
        targetLForeX = -0.7;
        targetRForeX = -0.7;
        targetCapeX = 0.32;
      }

      this.vampire.bodyPivot.position.y = THREE.MathUtils.damp(
        this.vampire.bodyPivot.position.y,
        targetDropY * poseWeight,
        16,
        realDt,
      );
      this.vampire.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.vampire.bodyPivot.rotation.x,
        targetBodyX * poseWeight,
        16,
        realDt,
      );
      this.vampire.spinePivot.rotation.set(
        targetSpineX * poseWeight,
        targetSpineY * poseWeight,
        0,
      );
      this.vampire.head.rotation.set(targetHeadX * poseWeight, 0, targetHeadZ * poseWeight);
      this.vampire.leftArm.rotation.set(
        targetLArmX * poseWeight,
        0,
        THREE.MathUtils.lerp(-0.05, targetLArmZ, poseWeight),
      );
      this.vampire.rightArm.rotation.set(
        targetRArmX * poseWeight,
        0,
        THREE.MathUtils.lerp(0.05, targetRArmZ, poseWeight),
      );
      this.vampire.leftForearm.rotation.set(
        THREE.MathUtils.lerp(-0.22, targetLForeX, poseWeight),
        0,
        0,
      );
      this.vampire.rightForearm.rotation.set(
        THREE.MathUtils.lerp(-0.22, targetRForeX, poseWeight),
        0,
        0,
      );
      const braceLegL = this.feedTakedownKind === 'aerial' ? -0.45 : -0.14;
      const braceLegR = this.feedTakedownKind === 'aerial' ? 0.25 : 0.14;
      const braceShinL = this.feedTakedownKind === 'aerial' ? 0.65 : 0.16;
      const braceShinR = this.feedTakedownKind === 'aerial' ? 0.42 : 0.12;
      this.vampire.leftLeg.rotation.x = THREE.MathUtils.damp(
        this.vampire.leftLeg.rotation.x,
        braceLegL * poseWeight,
        14,
        realDt,
      );
      this.vampire.rightLeg.rotation.x = THREE.MathUtils.damp(
        this.vampire.rightLeg.rotation.x,
        braceLegR * poseWeight,
        14,
        realDt,
      );
      this.vampire.leftShin.rotation.x = THREE.MathUtils.damp(
        this.vampire.leftShin.rotation.x,
        braceShinL * poseWeight,
        14,
        realDt,
      );
      this.vampire.rightShin.rotation.x = THREE.MathUtils.damp(
        this.vampire.rightShin.rotation.x,
        braceShinR * poseWeight,
        14,
        realDt,
      );
      this.vampire.cape.rotation.x = THREE.MathUtils.damp(
        this.vampire.cape.rotation.x,
        THREE.MathUtils.lerp(0.06, targetCapeX, poseWeight),
        12,
        realDt,
      );

      for (const def of this.vampire.stealthMatDefaults) {
        if (this.obfuscateTimer > 0) {
          def.mat.color.lerp(_color.setHex(0x38bdf8), Math.min(1, realDt * 8));
          def.mat.emissive.lerp(_color2.setHex(0x1d4ed8), Math.min(1, realDt * 8));
          def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0.42, 8, realDt);
          def.mat.opacity = THREE.MathUtils.damp(def.mat.opacity, 0.34, 8, realDt);
        } else {
          def.mat.color.lerp(_color.setHex(def.baseColor), Math.min(1, realDt * 10));
          def.mat.emissive.lerp(_color2.setHex(0x000000), Math.min(1, realDt * 10));
          def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0, 10, realDt);
          def.mat.opacity = THREE.MathUtils.damp(def.mat.opacity, 1.0, 10, realDt);
        }
      }

      // Blood droplets drawn directly from the victim's neck into the vampire
      if (Math.random() < 0.75) {
        _v2.set(
          this.feedTarget.position.x,
          this.feedTarget.position.y + 1.44,
          this.feedTarget.position.z,
        );
        this.emitParticles(_v2, 2, 0xdc2626, 1.4, 0.48, 0.15, 0.92, true);
      }

      this.feedBloodTickTimer -= realDt;
      if (this.feedBloodTickTimer <= 0) {
        this.feedBloodTickTimer = 0.26;
        this.audio.playFeedSiphonTick(prog);
      }

      if (this.feedTimer <= 0) {
        const target = this.feedTarget;
        target.state = 'drained';
        target.rig.hpBarGroup.visible = false;
        target.rig.alertSpriteMesh.visible = false;
        target.rig.crimsonPulseMesh.visible = false;
        if (target.rig.visionCone) target.rig.visionCone.visible = false;
        target.corpseDiscovered = false;
        target.rig.bodyGroup.rotation.z = 0;
        // If drained in dark shadows, under Obfuscate, or from Bote das Cornijas, corpse is concealed!
        const corniceStealthHide =
          this.feedIsAerial && (this.hasSkill('rap_3b') || this.hasSkill('amal_nocturnal_stalker'));
        target.corpseHidden =
          this.isPositionInShadow(target.position) || this.obfuscateTimer > 0 || corniceStealthHide;
        if (target.corpseHidden) {
          target.rig.root.visible = false;
          target.deathFallTimer = 0;
        } else {
          target.deathFallStartRotX = target.rig.bodyGroup.rotation.x;
          target.deathFallStartY = target.rig.bodyGroup.position.y;
          target.deathFallTimer = 0.45;
        }
        target.respawnTimer = 22;
        if (target.archetype === 'bodyguard' && target.escortTarget) {
          target.escortTarget.hasBodyguard = false;
        }

        // Check final completion witnesses before clearing feedTarget
        let completionWitnessed = this.feedWitnessed;
        if (!completionWitnessed && this.obfuscateTimer <= 0) {
          for (const other of this.npcs) {
            if (
              other === target ||
              other.state === 'drained' ||
              other.state === 'stunned'
            ) {
              continue;
            }
            const d = Math.hypot(other.position.x - target.position.x, other.position.z - target.position.z);
            if (d <= 15.0 && Math.abs(other.position.y - target.position.y) < 4.5) {
              _v1.set(target.position.x - other.position.x, 0, target.position.z - other.position.z).normalize();
              _v2.set(Math.sin(other.yaw), 0, Math.cos(other.yaw));
              if (_v1.dot(_v2) > -0.1 && hasLineOfSight(other.position, target.position, this.world.volumes)) {
                completionWitnessed = true;
                break;
              }
            }
          }
        }

        this.feedTarget = null;
        this.vampire.bodyPivot.position.y = 0;
        this.vampire.bodyPivot.rotation.set(0, 0, 0);
        this.vampire.spinePivot.rotation.set(0, 0, 0);
        this.vampire.head.rotation.set(0, 0, 0);

        const aerialUsed = this.feedIsAerial;
        const stealthUsed = this.feedIsStealth;
        const wasObfuscated = this.obfuscateTimer > 0 || this.mistFormTimer > 0 || this.abyssalShroudTimer > 0;
        const essenceBonus = this.hasSkill('met_1') ? 1.25 : 1.0;
        const obfBonus = this.hasSkill('ofu_3') && (wasObfuscated || target.corpseHidden) ? 1.25 : 1.0;
        const corniceBonus = aerialUsed && this.hasSkill('rap_3b') ? 20 : 0;
        const corniceBlood = aerialUsed && this.hasSkill('rap_3b') ? 14 : 0;
        const aerialBonus = aerialUsed
          ? 15 + corniceBonus + (this.hasSkill('amal_nightmare') ? 15 : 0)
          : 0;
        this.feedIsAerial = false;
        this.feedIsStealth = true;
        const healBonus = (this.hasSkill('met_1') ? 10 : 0) + (aerialUsed && this.hasSkill('amal_nightmare') ? 18 : 0);
        const prevBlood = this.blood;
        this.blood = Math.min(this.maxBlood, this.blood + target.bloodReward + corniceBlood);
        const gainedBlood = Math.round(this.blood - prevBlood);
        this.health = Math.min(this.maxHealth, this.health + 12 + healBonus);
        const gainedEssence = stealthUsed
          ? Math.round(target.essenceReward * essenceBonus * obfBonus) + aerialBonus
          : Math.max(4, Math.round(target.essenceReward * 0.45));
        this.pendingEssence += gainedEssence;

        // Only stealth drains count toward the night's hunted victims quota
        if (stealthUsed) {
          this.killsThisNight += target.huntPoints;
        }
        this.totalKills += 1;
        if (target.archetype === 'noble') this.noblesDrained += 1;
        if (target.isMainTarget) this.mainTargetDefeated = true;
        if (
          target.archetype === 'guard' ||
          target.archetype === 'bodyguard' ||
          target.archetype === 'hunter'
        ) {
          this.guardsSlain += 1;
        }

        const methodLabel = aerialUsed
          ? 'Bote Aéreo Letal'
          : !stealthUsed
          ? 'Execução em Combate'
          : wasObfuscated
          ? 'Drenagem sob Ofuscação'
          : 'Drenagem Furtiva';
        this.recordHuntLog(target, methodLabel, gainedEssence);

        // Increase Infamy if combat execution, witnessed, OR corpse exposed in busy area
        const infamyMap: Record<NpcArchetype, number> = {
          beggar: 3,
          citizen: 8,
          cultist: 12,
          guard: 16,
          bodyguard: 22,
          hunter: 22,
          noble: 26,
        };
        const distId = this.getDistrictAt(target.position);
        const isBusyArea = distId === 'avenue' || distId === 'cathedral' || distId === 'cemetery';
        if (!stealthUsed) {
          this.addDistrictInfamy(target.position, Math.round(infamyMap[target.archetype] * 1.35) + 4);
        } else if (completionWitnessed) {
          this.addDistrictInfamy(target.position, infamyMap[target.archetype]);
        } else if (!target.corpseHidden && isBusyArea) {
          this.addDistrictInfamy(target.position, Math.round(infamyMap[target.archetype] * 0.55));
        }

        // Nobles unlock 1 uncollected Memory Fragment upon being drained
        let unlockedMemTitle: string | null = null;
        if (target.archetype === 'noble') {
          const nextFrag = MEMORY_FRAGMENTS.find((f) => !this.collectedMemories.includes(f.id));
          if (nextFrag) {
            this.collectedMemories.push(nextFrag.id);
            const worldMem = this.world.memories.find((m) => m.id === nextFrag.id);
            if (worldMem) {
              worldMem.collected = true;
              worldMem.group.visible = false;
            }
            unlockedMemTitle = nextFrag.title;
          }
        }

        // Cultists / Apothecaries grant a temporary Power Regeneration Surge (18s)
        let grantedPowerRegen = false;
        if (target.archetype === 'cultist') {
          this.powerRegenTimer = 18.0;
          grantedPowerRegen = true;
        }

        // Strategic weakness discoveries from feeding & takedown method
        if (
          target.archetype === 'noble' ||
          target.archetype === 'guard' ||
          target.archetype === 'hunter' ||
          target.archetype === 'cultist'
        ) {
          const prof = NPC_DOSSIER_PROFILES.find((p) => p.name === target.name);
          if (prof) {
            if (aerialUsed) {
              if (target.name === 'Barão Thorne') this.discoverWeakness(target.name, 'aerial_ambush');
              else if (target.name === 'Sentinela Sacra') this.discoverWeakness(target.name, 'vertical_blind');
            }
            if (target.corpseHidden && target.name === 'Lorde Valerius') {
              this.discoverWeakness(target.name, 'lamp_blind');
            }
            if (this.weather === 'rain' && target.name === 'Condessa Eleanor') {
              this.discoverWeakness(target.name, 'rain_approach');
            }
            // Guarantee primary dossier weakness upon draining the target
            this.discoverWeakness(target.name, prof.weaknesses[0].id);
          }
        }

        this.audio.playFeedComplete();
        const bloodLabel = gainedBlood > 0 ? `+${gainedBlood} Sangue` : 'Sangue Máx.';
        const bonusSuffix = unlockedMemTitle
          ? ` · Memória: ${unlockedMemTitle}`
          : grantedPowerRegen
          ? ' · Regen. de Poder (18s)!'
          : target.corpseHidden
          ? ' (Oculto nas Sombras)'
          : ' ([G] ocultar corpo)';
        this.showBanner(
          `${bloodLabel} · +${gainedEssence} Essência (pendente) — ${target.name}${bonusSuffix}`,
          3.2,
        );
        this.pushHudSnapshot(true);
      }
      return;
    }

    // Melee Claw Combat (Left Click when locked or Key X)
    if ((this.justPressed.has('KeyX') || this.justPressed.has('ClawAttack')) && this.clawCooldown <= 0) {
      this.performClawAttack();
    }

    // Ofuscação Nv.2A: Ofuscação Espectral — 14 Blood
    if (this.justPressed.has(this.hotkeys.obfuscate) && this.canUsePower('obfuscate') && this.cooldowns.obfuscate <= 0) {
      if (this.blood < 14) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= 14;
        this.cooldowns.obfuscate = this.getSkillCooldownMax('obfuscate');
        this.obfuscateTimer =
          (this.hasSkill('ofu_3') ? 9.5 : 8.0) + (this.hasSkill('amal_eclipse') ? 2.5 : 0);
        this.castAnimTimer = 0.28;
        this.audio.playObfuscate(true);
        this.emitParticles(
          this.playerPos.clone().setY(this.playerPos.y + 1.1),
          20,
          0x38bdf8,
          3.4,
          0.6,
          0.3,
          1.2,
        );
        this.reportSupernaturalWitness('Ofuscação', 13.0, 12, 7);
        this.showBanner('Ofuscação ativa — Silhueta espectral oculta aos mortais!', 2.4);
      }
    }

    // Ofuscação Nv.2B: Falso Semblante — 14 Blood
    if (this.justPressed.has(this.hotkeys.falseVisage) && this.canUsePower('falseVisage') && this.cooldowns.falseVisage <= 0) {
      if (this.blood < 14) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= 14;
        this.cooldowns.falseVisage = this.getSkillCooldownMax('falseVisage');
        this.falseVisageTimer = 10.0 + (this.hasSkill('amal_masquerade') ? 3.0 : 0);
        this.castAnimTimer = 0.25;
        this.audio.playFalseVisage();
        this.emitParticles(
          this.playerPos.clone().setY(this.playerPos.y + 1.2),
          18,
          0xfde68a,
          3.0,
          0.65,
          0.4,
          1.05,
        );
        this.showBanner('Falso Semblante ativo — Sentinelas o verão como um cidadão comum.', 2.6);
      }
    }

    // Ofuscação Nv.3B: Simulacro Sombrio — 12 Blood (spawns shadow doppelganger ahead to lure nearby NPCs)
    if (
      this.justPressed.has(this.hotkeys.shadowDecoy) &&
      this.canUsePower('shadowDecoy') &&
      this.cooldowns.shadowDecoy <= 0
    ) {
      if (this.blood < 12) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= 12;
        this.cooldowns.shadowDecoy = this.getSkillCooldownMax('shadowDecoy');
        this.castAnimTimer = 0.24;
        const lookX = -Math.sin(this.camYaw);
        const lookZ = -Math.cos(this.camYaw);
        const dist = 6.8;
        this.shadowDecoyPos.set(this.playerPos.x + lookX * dist, this.playerPos.y, this.playerPos.z + lookZ * dist);
        resolveHorizontal3D(this.shadowDecoyPos, 0.5, this.world.volumes, this.world.playableBounds);
        this.shadowDecoyPos.y = getFloorHeightAt(
          this.shadowDecoyPos.x,
          this.shadowDecoyPos.z,
          this.playerPos.y + 1.5,
          0.35,
          this.world.volumes,
          this.world.cryptBounds,
        );
        this.shadowDecoyTimer = 7.5;
        this.shadowDecoyPulseTimer = 1.1;
        this.shadowDecoyGroup.position.copy(this.shadowDecoyPos);
        this.shadowDecoyGroup.visible = true;
        this.audio.playShadowDecoy();
        this.emitDarkSmoke(this.shadowDecoyPos.clone().setY(this.shadowDecoyPos.y + 0.9), 10, 0.85);
        this.emitParticles(this.shadowDecoyPos.clone().setY(this.shadowDecoyPos.y + 1.1), 16, 0x38bdf8, 3.2, 0.55, 0.2, 1.0);
        this.lureNpcsToDecoy(true);
        this.showBanner('Simulacro Sombrio invocado — Guardas próximos estão sendo atraídos.', 2.6);
      }
    }

    // Dominação Nv.1: Comando Hipnótico — 9–12 Blood (Oracle -4)
    if (this.justPressed.has(this.hotkeys.dominate) && this.canUsePower('dominate') && this.cooldowns.dominate <= 0) {
      const domCost = Math.max(5, (this.hasSkill('dom_3') ? 9 : 12) - (this.hasSkill('amal_oracle') ? 4 : 0));
      if (this.blood < domCost) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        const domRange = (this.hasSkill('dom_3') ? 18 : 11) + (this.hasSkill('amal_oracle') ? 4 : 0);
        const lookX = -Math.sin(this.camYaw);
        const lookZ = -Math.cos(this.camYaw);
        let domTarget: NpcEntity | null = null;
        let domBestDist = domRange;

        for (const npc of this.npcs) {
          if (npc.state === 'drained') continue;
          const dx = npc.position.x - this.playerPos.x;
          const dz = npc.position.z - this.playerPos.z;
          const d = Math.hypot(dx, dz);
          if (d > domBestDist || Math.abs(npc.position.y - this.playerPos.y) > 4.2) continue;
          const dot = d > 0.05 ? (dx / d) * lookX + (dz / d) * lookZ : 1;
          if (dot >= 0.35 && hasLineOfSight(this.playerPos, npc.position, this.world.volumes)) {
            domTarget = npc;
            domBestDist = d;
          }
        }

        if (!domTarget) {
          this.showBanner('Nenhum alvo mortal no campo de Dominação.', 1.8);
        } else {
          this.blood -= domCost;
          this.cooldowns.dominate = this.getSkillCooldownMax('dominate');
          this.castAnimTimer = 0.28;
          this.audio.playDominate();

          const hypnotized: NpcEntity[] = [];
          const applyTrance = (target: NpcEntity) => {
            hypnotized.push(target);
            target.state = 'stunned';
            target.stateTimer = 5.0;
            target.suspicion = 0;
            target.targetBell = null;
            target.attackWindup = 0;
            this.emitParticles(
              target.position.clone().setY(target.position.y + 1.45),
              16,
              0xc026d3,
              3.2,
              0.55,
              0.4,
              1.1,
            );
          };

          applyTrance(domTarget);

          if (this.hasSkill('dom_3')) {
            for (const other of this.npcs) {
              if (other === domTarget || other.state === 'drained') continue;
              if (other.position.distanceTo(domTarget.position) <= 6.5) {
                applyTrance(other);
                break;
              }
            }
            this.globalSuspicion = Math.max(0, this.globalSuspicion - 7);
            const curDist = this.getDistrictAt(this.playerPos);
            this.districtInfamy[curDist] = Math.max(0, this.districtInfamy[curDist] - 10);
          }

          if (this.obfuscateTimer <= 0 && this.falseVisageTimer <= 0) {
            this.reportSupernaturalWitness('Dominação Mental', 14.0, 12, 8, hypnotized);
          }
          this.showBanner(`Dominação: ${domTarget.name} caiu em transe hipnótico!`, 2.4);
        }
      }
    }

    // Dominação Nv.2A: Apagar Memória — 11–15 Blood
    if (this.justPressed.has(this.hotkeys.memoryWipe) && this.canUsePower('memoryWipe') && this.cooldowns.memoryWipe <= 0) {
      const wipeCost = Math.max(6, 15 - (this.hasSkill('amal_oracle') ? 4 : 0));
      if (this.blood < wipeCost) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= wipeCost;
        this.cooldowns.memoryWipe = this.getSkillCooldownMax('memoryWipe');
        this.castAnimTimer = 0.28;
        this.audio.playMemoryWipe();
        const wipeRadius = 12 + (this.hasSkill('amal_oracle') ? 4 : 0);
        let wipedCount = 0;
        for (const npc of this.npcs) {
          if (npc.state === 'drained') continue;
          if (npc.position.distanceTo(this.playerPos) <= wipeRadius) {
            if (npc.state !== 'patrol') wipedCount++;
            npc.state = 'patrol';
            npc.suspicion = 0;
            npc.targetBell = null;
            npc.attackWindup = 0;
            npc.waypointIndex = this.pickBestWaypoint(npc);
          }
        }
        const curDist = this.getDistrictAt(this.playerPos);
        const infamyDrop = 12 + (this.hasSkill('amal_masquerade') ? 10 : 0);
        this.districtInfamy[curDist] = Math.max(0, this.districtInfamy[curDist] - infamyDrop);
        this.globalSuspicion = Math.max(0, this.globalSuspicion - 8);
        this.emitParticles(this.playerPos.clone().setY(this.playerPos.y + 1.1), 24, 0xc084fc, 6.0, 0.65, 0.1, 1.15);
        this.showBanner(
          `Memória Apagada (${wipedCount} mentes) · -${infamyDrop}% Infâmia local.`,
          2.6,
        );
      }
    }

    // Dominação Nv.2B: Possessão — 14–18 Blood
    if (this.justPressed.has(this.hotkeys.possess) && this.canUsePower('possess') && this.cooldowns.possess <= 0) {
      const posCost = Math.max(8, 18 - (this.hasSkill('amal_oracle') ? 4 : 0));
      if (this.blood < posCost) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        const posRange = 13 + (this.hasSkill('amal_oracle') ? 4 : 0);
        const lookX = -Math.sin(this.camYaw);
        const lookZ = -Math.cos(this.camYaw);
        let posTarget: NpcEntity | null = null;
        let posBest = posRange;
        for (const npc of this.npcs) {
          if (npc.state === 'drained') continue;
          const dx = npc.position.x - this.playerPos.x;
          const dz = npc.position.z - this.playerPos.z;
          const d = Math.hypot(dx, dz);
          if (d > posBest || Math.abs(npc.position.y - this.playerPos.y) > 4.2) continue;
          const dot = d > 0.05 ? (dx / d) * lookX + (dz / d) * lookZ : 1;
          if (dot >= 0.35 && hasLineOfSight(this.playerPos, npc.position, this.world.volumes)) {
            posTarget = npc;
            posBest = d;
          }
        }
        if (!posTarget) {
          this.showBanner('Nenhum mortal visível para Possessão.', 1.8);
        } else {
          this.blood -= posCost;
          this.cooldowns.possess = this.getSkillCooldownMax('possess');
          this.castAnimTimer = 0.28;
          this.audio.playPossess();
          posTarget.state = 'possessed';
          posTarget.possessTimer = 8.0;
          posTarget.suspicion = 0;
          posTarget.targetBell = null;
          posTarget.attackWindup = 0;

          // Steer possessed victim toward nearest shadow zone / dark alley away from current spot
          let lurePos = posTarget.position.clone().add(_v1.set(-lookX * 14, 0, -lookZ * 14));
          let bestSzDist = Infinity;
          for (const sz of this.world.shadowZones) {
            const d = Math.hypot(sz.x - posTarget.position.x, sz.z - posTarget.position.z);
            if (d > 5.5 && d < 24 && d < bestSzDist) {
              bestSzDist = d;
              lurePos.set(sz.x, sz.y, sz.z);
            }
          }
          resolveHorizontal3D(lurePos, 0.5, this.world.volumes, this.world.playableBounds);
          posTarget.possessPos.copy(lurePos);

          this.emitParticles(posTarget.position.clone().setY(posTarget.position.y + 1.4), 18, 0xa855f7, 3.6, 0.6, 0.2, 1.1);
          this.showBanner(`Possessão: ${posTarget.name} está sendo atraído para as sombras!`, 2.6);
        }
      }
    }

    // Rapidez Nv.1: Celeridade — 14 Blood
    if (this.justPressed.has(this.hotkeys.celerity) && this.canUsePower('celerity') && this.cooldowns.celerity <= 0) {
      if (this.blood < 14) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= 14;
        this.cooldowns.celerity = this.getSkillCooldownMax('celerity');
        this.celerityTimer = this.hasSkill('rap_3') ? 8.0 : 5.0;
        this.castAnimTimer = 0.28;
        this.audio.playCelerity();
        this.emitParticles(
          this.playerPos.clone().setY(this.playerPos.y + 1.0),
          18,
          0xdc2626,
          5.2,
          0.45,
          0.1,
          1.1,
        );
        if (this.obfuscateTimer <= 0 && this.falseVisageTimer <= 0) {
          this.reportSupernaturalWitness('Celeridade', 14.0, 10, 6);
        }
        this.showBanner('Celeridade — Reflexos e velocidade sobrenaturais!', 2.2);
      }
    }

    // Rapidez Nv.2A: Salto das Sombras — 11 Blood (roof-scaling vertical + forward leap)
    if (this.justPressed.has(this.hotkeys.shadowLeap) && this.canUsePower('shadowLeap') && this.cooldowns.shadowLeap <= 0) {
      if (this.blood < 11) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= 11;
        this.cooldowns.shadowLeap = this.getSkillCooldownMax('shadowLeap');
        this.playerVelY = this.hasSkill('rap_3') ? 16.0 : 14.5;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.isCrouching = false;

        this.computeMoveDirection(_v1);
        if (_v1.lengthSq() < 0.01) {
          _v1.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
        }
        _v1.normalize();
        this.playerYaw = Math.atan2(_v1.x, _v1.z);
        this.playerPos.addScaledVector(_v1, 1.35);
        resolveHorizontal3D(this.playerPos, 0.52, this.world.volumes, this.world.playableBounds);

        this.audio.playShadowLeap();
        this.emitDarkSmoke(this.playerPos.clone().setY(this.playerPos.y + 0.3), 9, 0.75);
        this.emitParticles(this.playerPos.clone().setY(this.playerPos.y + 0.6), 14, 0xfb7185, 4.5, 0.45, -1, 1.0);
        if (this.obfuscateTimer <= 0 && this.falseVisageTimer <= 0) {
          this.reportSupernaturalWitness('Salto das Sombras', 14.0, 9, 5);
        }
      }
    }

    // Rapidez Nv.2B: Arremesso Sombrio — 10 Blood (fires fast shadow blade forward up to 26m)
    if (this.justPressed.has(this.hotkeys.shadowThrow) && this.canUsePower('shadowThrow') && this.cooldowns.shadowThrow <= 0) {
      if (this.blood < 10) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= 10;
        this.cooldowns.shadowThrow = this.getSkillCooldownMax('shadowThrow');
        this.castAnimTimer = 0.2;
        this.audio.playShadowThrow();

        const cosP = Math.cos(this.camPitch);
        _v2
          .set(-Math.sin(this.camYaw) * cosP, -Math.sin(this.camPitch) + 0.015, -Math.cos(this.camYaw) * cosP)
          .normalize();
        this.playerYaw = Math.atan2(_v2.x, _v2.z);

        _v1.set(
          this.playerPos.x + _v2.x * 0.65,
          this.camSmoothFloorY + this.camEyeHeight - 0.14 + _v2.y * 0.65,
          this.playerPos.z + _v2.z * 0.65,
        );
        this.spawnProjectile(false, _v1, _v2.multiplyScalar(32), 0.85);
        this.emitParticles(_v1, 8, 0xa855f7, 2.8, 0.3, 0, 0.85);
        if (this.obfuscateTimer <= 0 && this.falseVisageTimer <= 0) {
          this.reportSupernaturalWitness('Arremesso Sombrio', 13.0, 9, 5);
        }
      }
    }

    // Hide Exposed Corpse (Key G)
    if (this.justPressed.has('KeyG')) {
      const corpse = this.findNearbyExposedCorpse();
      if (corpse) {
        corpse.corpseHidden = true;
        corpse.rig.root.visible = false;
        this.emitDarkSmoke(corpse.position.clone().setY(0.35), 6, 0.6);
        this.audio.playBellSabotage();
        if (corpse.name === 'Magistrado Vance') {
          this.discoverWeakness('Magistrado Vance', 'silent_corpse');
        }
        this.showBanner('Corpo ocultado nas sombras.', 1.8);
      }
    }

    // Jump / Ledge Climb (Space) with coyote time
    if (this.justPressed.has('Space')) {
      if (this.isGrounded || this.coyoteTimer > 0) {
        const jumpVel = this.hasSkill('rap_3') ? 11.4 : 9.1;
        this.playerVelY = jumpVel;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.isCrouching = false;
        this.jumpLandAnimTimer = 0;
        this.audio.playFootstep(false);
      } else {
        this.tryLedgeMantle(true);
      }
    }

    // Tenebrosidade Nv.1: Passo das Sombras — 10 Blood
    if (this.justPressed.has(this.hotkeys.shadowDash) && this.canUsePower('shadowDash') && this.cooldowns.shadowDash <= 0) {
      if (this.blood < 10) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        const wasHidden = this.obfuscateTimer > 0 || this.hasSkill('amal_eclipse');
        this.blood -= 10;
        this.cooldowns.shadowDash = this.getSkillCooldownMax('shadowDash');
        this.dashTimer = this.hasSkill('ten_3') ? 0.25 : 0.2;
        if (this.hasSkill('ten_3')) this.shadowVeilTimer = 1.8;
        this.playerVelY = Math.max(this.playerVelY, 1.5);

        this.computeMoveDirection(_v1);
        if (_v1.lengthSq() < 0.01) {
          _v1.set(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw));
        }
        this.dashDir.copy(_v1).normalize();
        this.audio.playShadowDash();
        this.emitDarkSmoke(this.playerPos.clone().setY(this.playerPos.y + 0.55), 10, 0.85);
        if (!wasHidden) {
          this.reportSupernaturalWitness('Passo das Sombras', 14.0, 10, 6);
        }
      }
    }

    // Interações com E (Caixão da Cripta / Sino / Memória) e Apagar Luz (Tenebrosidade Nv.2A — 8 Sangue)
    const snuffSameKeyAsE = this.hotkeys.snuffLamp === 'KeyE';
    let interactedWithWorldE = false;
    if (this.justPressed.has('KeyE')) {
      const nearCoffin =
        Math.hypot(this.playerPos.x - this.world.coffinPos.x, this.playerPos.z - this.world.coffinPos.z) <= 3.3 &&
        Math.abs(this.playerPos.y - this.world.coffinPos.y) <= 2.2;
      const bell = !nearCoffin
        ? this.world.bells.find((b) => !b.sabotaged && b.position.distanceTo(this.playerPos) <= 3.3)
        : undefined;
      const memory = !nearCoffin && !bell ? this.findNearbyMemoryFragment() : null;
      if (nearCoffin) {
        interactedWithWorldE = true;
        const quotaMet = this.killsThisNight >= this.quotaThisNight;
        const quotaBonus = quotaMet ? 20 : 0;
        const consolidated = this.pendingEssence + quotaBonus;
        this.essence += consolidated;
        this.pendingEssence = 0;
        const infamyKeepMult = quotaMet ? 0.55 : 0.7;
        const infamyReliefPct = quotaMet ? 45 : 30;
        this.globalSuspicion = Math.max(0, Math.round(this.globalSuspicion * infamyKeepMult));
        (Object.keys(this.districtInfamy) as DistrictId[]).forEach((d) => {
          this.districtInfamy[d] = Math.max(0, Math.round(this.districtInfamy[d] * infamyKeepMult));
        });
        this.lastNightSummary = {
          nightNumber: this.nightNumber,
          kills: this.killsThisNight,
          quota: this.quotaThisNight,
          quotaMet,
          essenceConsolidated: consolidated,
          quotaBonus,
          infamyReliefPct,
        };
        if (quotaBonus > 0) {
          this.showBanner(
            `Cota cumprida! +${consolidated} Essência consolidada (+20 bônus) · -${infamyReliefPct}% Infâmia.`,
            3.2,
          );
        } else {
          this.showBanner(
            `Caçada encerrada — +${consolidated} Essência consolidada · -${infamyReliefPct}% Infâmia.`,
            3.0,
          );
        }
        this.audio.playCoffinRest();
        this.callbacks.onPhaseRequest('victory');
        this.setPhase('victory');
        return;
      } else if (bell) {
        interactedWithWorldE = true;
        bell.sabotaged = true;
        bell.ringTimer = 0;
        bell.ropeMesh.visible = false;
        bell.bellPivot.rotation.z = 0.25;
        bell.beaconMat.color.setHex(0x334155);
        this.pendingEssence += 12;
        this.globalSuspicion = Math.max(0, this.globalSuspicion - 10);
        this.audio.playBellSabotage();
        this.emitParticles(bell.position.clone().setY(2.2), 12, 0x94a3b8, 3.0, 0.5, -2.0, 0.9);
        this.showBanner(`${bell.name} sabotado (+12 Essência pendente).`, 2.2);
        for (const npc of this.npcs) {
          if (npc.state === 'drained') continue;
          if (npc.position.distanceTo(bell.position) <= 22) {
            if (npc.name === 'Lorde Valerius') this.discoverWeakness(npc.name, 'bell_panic');
            if (npc.name === 'Sentinela Sacra') this.discoverWeakness(npc.name, 'sabotage_counter');
          }
        }
      } else if (memory) {
        interactedWithWorldE = true;
        memory.collected = true;
        memory.group.visible = false;
        if (!this.collectedMemories.includes(memory.id)) {
          this.collectedMemories.push(memory.id);
        }
        this.pendingEssence += 15;
        this.audio.playMemoryCollect();
        this.emitParticles(memory.position.clone().setY(memory.position.y + 0.9), 20, 0x818cf8, 3.8, 0.65, 0.5, 1.0);
        this.showBanner(`Memória Recuperada: ${memory.title} (+15 Essência pendente)`, 2.8);
        this.pushHudSnapshot(true);
      }
    }

    const triggerSnuff =
      this.justPressed.has(this.hotkeys.snuffLamp) && (!snuffSameKeyAsE || !interactedWithWorldE);
    if (triggerSnuff && this.canUsePower('snuffLamp') && this.cooldowns.snuffLamp <= 0) {
      if (this.blood < 8) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        const range = this.hasSkill('ten_3') ? 17 : 14;
        const maxLamps = this.hasSkill('ten_3') ? 2 : 1;
        let snuffed = 0;
        const sorted = [...this.world.lamps]
          .filter((l) => l.isLit)
          .sort((a, b) => a.position.distanceToSquared(this.playerPos) - b.position.distanceToSquared(this.playerPos));

        for (const lamp of sorted) {
          if (snuffed >= maxLamps) break;
          if (lamp.position.distanceTo(this.playerPos) <= range) {
            this.setLampLit(lamp, false);
            this.emitDarkSmoke(lamp.position.clone().setY(4.45), 9, 0.7);
            this.emitParticles(lamp.position.clone().setY(4.8), 10, 0xff9c3b, 3.0, 0.55, -2.0, 0.95);
            for (const npc of this.npcs) {
              if (npc.name === 'Lorde Valerius' && npc.position.distanceTo(lamp.position) <= 14) {
                this.discoverWeakness('Lorde Valerius', 'lamp_blind');
              }
            }
            snuffed++;
          }
        }
        if (snuffed > 0) {
          this.cooldowns.snuffLamp = this.getSkillCooldownMax('snuffLamp');
          this.blood = Math.max(0, this.blood - 8);
          this.castAnimTimer = 0.22;
          this.emitDarkSmoke(this.playerPos.clone().setY(this.playerPos.y + 0.9), 6, 0.55);
          this.audio.playSnuffLamp();
        }
      }
    }

    // Tenebrosidade Nv.2B: Laço das Sombras — 12 Blood
    if (this.justPressed.has(this.hotkeys.shadowSnare) && this.canUsePower('shadowSnare') && this.cooldowns.shadowSnare <= 0) {
      if (this.blood < 12) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        const lookX = -Math.sin(this.camYaw);
        const lookZ = -Math.cos(this.camYaw);
        let snareTarget: NpcEntity | null = null;
        let bestDist = 15.0;
        for (const npc of this.npcs) {
          if (npc.state === 'drained') continue;
          const dx = npc.position.x - this.playerPos.x;
          const dz = npc.position.z - this.playerPos.z;
          const d = Math.hypot(dx, dz);
          if (d > bestDist || Math.abs(npc.position.y - this.playerPos.y) > 4.2) continue;
          const dot = d > 0.05 ? (dx / d) * lookX + (dz / d) * lookZ : 1;
          if (dot >= 0.35 && hasLineOfSight(this.playerPos, npc.position, this.world.volumes)) {
            snareTarget = npc;
            bestDist = d;
          }
        }
        if (!snareTarget) {
          this.showBanner('Nenhum alvo visível para Laço das Sombras.', 1.8);
        } else {
          this.blood -= 12;
          this.cooldowns.shadowSnare = this.getSkillCooldownMax('shadowSnare');
          this.castAnimTimer = 0.24;
          this.audio.playShadowSnare();
          snareTarget.state = 'stunned';
          snareTarget.stateTimer = 4.5;
          snareTarget.suspicion = 0;
          snareTarget.targetBell = null;
          snareTarget.attackWindup = 0;
          this.emitDarkSmoke(snareTarget.position.clone().setY(snareTarget.position.y + 0.6), 8, 0.65);
          this.emitParticles(snareTarget.position.clone().setY(snareTarget.position.y + 1.1), 16, 0x6366f1, 3.4, 0.55, 0.1, 1.05);
          if (this.obfuscateTimer <= 0 && !this.hasSkill('amal_eclipse')) {
            this.reportSupernaturalWitness('Laço das Sombras', 14.0, 10, 6, [snareTarget]);
          }
          this.showBanner(`Laço das Sombras imobilizou ${snareTarget.name}!`, 2.2);
        }
      }
    }

    // Tenebrosidade Nv.3: Mortalha Abissal — 18 Blood
    if (this.justPressed.has(this.hotkeys.abyssalShroud) && this.canUsePower('abyssalShroud') && this.cooldowns.abyssalShroud <= 0) {
      if (this.blood < 18) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= 18;
        this.cooldowns.abyssalShroud = this.getSkillCooldownMax('abyssalShroud');
        this.abyssalShroudTimer = 6.5;
        this.castAnimTimer = 0.3;
        this.audio.playAbyssalShroud();
        this.emitDarkSmoke(this.playerPos.clone().setY(this.playerPos.y + 0.8), 16, 1.25);
        this.emitParticles(this.playerPos.clone().setY(this.playerPos.y + 1.0), 26, 0x4f46e5, 4.8, 0.65, 0.4, 1.25);
        for (const lamp of this.world.lamps) {
          if (lamp.isLit && lamp.position.distanceTo(this.playerPos) <= 9.5) {
            this.setLampLit(lamp, false);
            this.emitDarkSmoke(lamp.position.clone().setY(4.45), 6, 0.6);
          }
        }
        if (this.obfuscateTimer <= 0 && !this.hasSkill('amal_eclipse')) {
          this.reportSupernaturalWitness('Mortalha Abissal', 15.0, 12, 7);
        }
        this.showBanner('Mortalha Abissal — Trevas vivas cobrem sua presença!', 2.5);
      }
    }

    // Tenebrosidade Nv.3B: Pulso de Escuridão — 18 Blood (Alley escape burst: snuffs lamps, spawns smoke, stuns pursuers & clears alert)
    if (
      this.justPressed.has(this.hotkeys.darknessPulse) &&
      this.canUsePower('darknessPulse') &&
      this.cooldowns.darknessPulse <= 0
    ) {
      if (this.blood < 18) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= 18;
        this.cooldowns.darknessPulse = this.getSkillCooldownMax('darknessPulse');
        this.castAnimTimer = 0.3;
        this.shadowVeilTimer = Math.max(this.shadowVeilTimer, this.hasSkill('ten_3') ? 4.2 : 3.4);
        this.darknessPulseTimer = this.darknessPulseMax;
        this.darknessPulseRing.position.set(this.playerPos.x, this.playerPos.y + 0.12, this.playerPos.z);
        this.darknessPulseRing.scale.setScalar(1.2);
        this.darknessPulseMat.opacity = 0.72;
        this.darknessPulseRing.visible = true;
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.28);
        this.audio.playDarknessPulse();
        this.emitDarkSmoke(this.playerPos.clone().setY(this.playerPos.y + 0.75), 18, 1.35);
        this.emitParticles(this.playerPos.clone().setY(this.playerPos.y + 1.0), 26, 0x4f46e5, 6.2, 0.65, 0.1, 1.2);

        let snuffedCount = 0;
        for (const lamp of this.world.lamps) {
          if (lamp.isLit && lamp.position.distanceTo(this.playerPos) <= 13.0) {
            this.setLampLit(lamp, false);
            this.emitDarkSmoke(lamp.position.clone().setY(4.45), 6, 0.65);
            snuffedCount++;
          }
        }
        let stunnedPursuers = 0;
        for (const npc of this.npcs) {
          if (npc.state === 'drained') continue;
          const d = npc.position.distanceTo(this.playerPos);
          if (d <= 9.5) {
            npc.state = 'stunned';
            npc.stateTimer = 2.6;
            npc.suspicion = 0;
            npc.attackWindup = 0;
            npc.targetBell = null;
            stunnedPursuers++;
          } else if (d <= 14.5 && (npc.state === 'alert' || npc.state === 'hunt')) {
            npc.state = 'curious';
            npc.suspicion = 0.3;
            npc.stateTimer = 3.5;
            npc.attackWindup = 0;
            npc.targetBell = null;
          }
        }
        this.showBanner(
          `Pulso de Escuridão: ${snuffedCount} lampiões apagados, ${stunnedPursuers} perseguidores atordoados!`,
          2.6,
        );
      }
    }

    // Metamorfose Nv.2A: Enxame de Morcegos — 16 Blood
    if (this.justPressed.has(this.hotkeys.batSwarm) && this.canUsePower('batSwarm') && this.cooldowns.batSwarm <= 0) {
      if (this.blood < 16) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= 16;
        this.cooldowns.batSwarm = this.getSkillCooldownMax('batSwarm');
        this.batFormTimer = 2.6;
        if (!this.isGrounded) this.playerVelY = Math.max(this.playerVelY, 3.2);
        this.audio.playBatSwarm();
        this.shakeIntensity = 0.25;
        this.emitSoundEvent(this.playerPos, 15.0, 86, 0x818cf8);
        const radius = this.hasSkill('met_3') ? 8.8 : 7.5;
        const stunDur = this.hasSkill('met_3') ? 5.5 : 4.0;

        this.emitDarkSmoke(this.playerPos.clone().setY(this.playerPos.y + 0.8), 10, 0.9);
        this.emitParticles(
          this.playerPos.clone().setY(this.playerPos.y + 1.1),
          24,
          0x0f172a,
          7.0,
          0.75,
          1.0,
          1.4,
        );
        const stunnedList: NpcEntity[] = [];
        for (const npc of this.npcs) {
          if (npc.state === 'drained') continue;
          if (npc.position.distanceTo(this.playerPos) <= radius) {
            npc.state = 'stunned';
            npc.stateTimer = stunDur;
            npc.suspicion = 0;
            stunnedList.push(npc);
            this.blood = Math.min(this.maxBlood, this.blood + 4);
            if (npc.name === 'Barão Thorne') this.discoverWeakness(npc.name, 'bat_stun');
            if (npc.name === 'Alabardeiro') this.discoverWeakness(npc.name, 'swarm_stun');
          }
        }
        if (this.hasSkill('met_3')) {
          for (const lamp of this.world.lamps) {
            if (lamp.isLit && lamp.position.distanceTo(this.playerPos) <= radius) {
              this.setLampLit(lamp, false);
              this.emitDarkSmoke(lamp.position.clone().setY(4.45), 6, 0.6);
            }
          }
        }
        this.reportSupernaturalWitness('Enxame de Morcegos', 18.0, 16, 10, stunnedList);
      }
    }

    // Metamorfose Nv.2B: Forma de Névoa — 16 Blood
    if (this.justPressed.has(this.hotkeys.mistForm) && this.canUsePower('mistForm') && this.cooldowns.mistForm <= 0) {
      if (this.blood < 16) {
        this.showBanner('Sangue insuficiente.', 1.8);
      } else {
        this.blood -= 16;
        this.cooldowns.mistForm = this.getSkillCooldownMax('mistForm');
        this.mistFormTimer = 4.5;
        this.castAnimTimer = 0.25;
        this.audio.playMistForm();
        this.emitParticles(this.playerPos.clone().setY(this.playerPos.y + 1.0), 24, 0xcbd5e1, 3.6, 0.7, 0.4, 1.3);
        this.showBanner('Forma de Névoa — Corpo dissolvido em bruma invulnerável!', 2.4);
      }
    }

    // Feed / Stealth / Aerial / Combat Finisher Takedown (F)
    if (this.justPressed.has('KeyF')) {
      const candidate = this.findFeedCandidate();
      if (candidate) {
        const tgt = candidate.npc;
        this.feedTarget = tgt;
        this.feedIsAerial = candidate.isAerial;
        this.feedIsStealth = candidate.isStealth;
        this.feedTakedownKind = candidate.isAerial
          ? 'aerial'
          : tgt.archetype === 'guard' || tgt.archetype === 'bodyguard' || tgt.archetype === 'hunter'
          ? 'guard'
          : tgt.archetype === 'noble'
          ? 'noble'
          : tgt.archetype === 'cultist'
          ? 'cultist'
          : 'civilian';

        const speedMult = this.hasSkill('met_1') ? 0.78 : 1.0;
        const senseMult = this.isCrimsonSense && this.hasSkill('aus_3') ? 0.55 : 1.0;
        const baseDur =
          this.feedTakedownKind === 'noble'
            ? 1.48
            : this.feedTakedownKind === 'aerial'
            ? 1.25
            : 1.32;
        this.feedDuration = baseDur * speedMult * senseMult;
        this.feedTimer = this.feedDuration;
        this.feedBloodTickTimer = 0.08;
        this.feedWitnessed = false;
        this.hitstopTimer = candidate.isAerial ? 0.065 : 0.048;
        this.shakeIntensity = candidate.isAerial ? 0.34 : 0.22;
        this.audio.playFeedDrain(candidate.isStealth);

        // Trigger PS2 slow-motion + old film grain filter for high-priority stealth takedowns
        const isHighPriorityStealth =
          candidate.isAerial ||
          (candidate.isStealth &&
            (tgt.archetype === 'noble' ||
              tgt.archetype === 'guard' ||
              tgt.archetype === 'bodyguard' ||
              tgt.archetype === 'hunter'));
        if (isHighPriorityStealth) {
          this.killSlowMoTimer = 1.55;
        }

        // Compute target-specific smooth embrace position kept clear of camera near clipping
        const fwdX = Math.sin(tgt.yaw);
        const fwdZ = Math.cos(tgt.yaw);
        if (this.feedTakedownKind === 'noble') {
          this.feedDesiredPos.set(
            tgt.position.x + fwdX * 0.88,
            tgt.position.y,
            tgt.position.z + fwdZ * 0.88,
          );
        } else if (this.feedTakedownKind === 'cultist') {
          const rightX = Math.cos(tgt.yaw);
          const rightZ = -Math.sin(tgt.yaw);
          this.feedDesiredPos.set(
            tgt.position.x + rightX * 0.68 - fwdX * 0.56,
            tgt.position.y,
            tgt.position.z + rightZ * 0.68 - fwdZ * 0.56,
          );
        } else {
          this.feedDesiredPos.set(
            tgt.position.x - fwdX * 0.88,
            tgt.position.y,
            tgt.position.z - fwdZ * 0.88,
          );
        }
        resolveHorizontal3D(this.feedDesiredPos, 0.48, this.world.volumes, this.world.playableBounds);

        this.playerVelY = 0;
        this.isGrounded = true;
        tgt.state = 'stunned';
        tgt.stateTimer = this.feedDuration + 0.6;
        if (candidate.isAerial) {
          this.emitParticles(
            tgt.position.clone().setY(tgt.position.y + 1.0),
            20,
            0x991b1b,
            5.5,
            0.5,
            -2.5,
            1.2,
          );
          this.showBanner('Bote Aéreo Letal!', 1.8);
        }
        return;
      }
    }

    // Horizontal Movement & Velocity Tracking for Acoustic Noise
    const prevX = this.playerPos.x;
    const prevZ = this.playerPos.z;
    const preLandVelY = this.playerVelY;
    this.wasGrounded = this.isGrounded;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      const dashSpeed = this.hasSkill('ten_3') ? 24 : 19;
      this.playerPos.addScaledVector(this.dashDir, dashSpeed * dt);
      if (Math.random() < 0.72) {
        this.emitDarkSmoke(this.playerPos.clone().setY(this.playerPos.y + 0.55), 1, 0.35);
      }
    } else {
      this.computeMoveDirection(_v1);
      const hasMove = _v1.lengthSq() > 0.001;
      const crouchSpeed = this.hasSkill('ofu_1') ? 4.2 : 3.2;
      const batBonus = this.batFormTimer > 0 ? 1.45 : this.mistFormTimer > 0 ? 1.25 : 1.0;
      const celerityBonus = this.celerityTimer > 0 ? (this.hasSkill('rap_3') ? 1.55 : 1.42) : 1.0;
      const speed = (crouchActive ? crouchSpeed : 6.4) * batBonus * celerityBonus;

      // Sync character facing with first-person camera look direction
      this.playerYaw = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));

      if (hasMove) {
        _v1.normalize();
        this.playerPos.addScaledVector(_v1, speed * dt);
        if (this.isGrounded) {
          this.walkCycle += dt * (crouchActive ? 6.5 : 10.5) * (this.celerityTimer > 0 ? 1.35 : 1.0);
          if (this.batFormTimer <= 0 && this.mistFormTimer <= 0) {
            const silentRun =
              this.hasSkill('ofu_3') || (this.obfuscateTimer > 0 && this.hasSkill('ofu_2a'));
            this.audio.playFootstep(crouchActive || silentRun);
          }
        }
        if (this.celerityTimer > 0 && Math.random() < 0.55) {
          this.emitParticles(
            this.playerPos.clone().setY(this.playerPos.y + 0.85),
            1,
            0x991b1b,
            1.4,
            0.28,
            0.2,
            0.85,
          );
        }
      } else {
        this.walkCycle = THREE.MathUtils.damp(this.walkCycle, 0, 8, dt);
      }
    }

    // Vertical Physics, Gravity & Tall-Ledge Mantle
    const gravity = this.batFormTimer > 0 ? -9.5 : this.mistFormTimer > 0 ? -13.0 : -22.0;
    if (this.dashTimer <= 0) {
      this.playerVelY += gravity * dt;
      this.playerPos.y += this.playerVelY * dt;
    }

    if (
      !this.isGrounded &&
      (this.heldKeys.has('KeyW') ||
        this.heldKeys.has('KeyA') ||
        this.heldKeys.has('KeyS') ||
        this.heldKeys.has('KeyD'))
    ) {
      this.tryLedgeMantle(false);
    }

    resolveHorizontal3D(this.playerPos, 0.52, this.world.volumes, this.world.playableBounds);

    const floorY = getFloorHeightAt(
      this.playerPos.x,
      this.playerPos.z,
      this.playerPos.y,
      0.42,
      this.world.volumes,
      this.world.cryptBounds,
    );
    if (this.playerPos.y <= floorY + 0.02 && this.playerVelY <= 0.1) {
      this.playerPos.y = floorY;
      this.playerVelY = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.12;
      if (!this.wasGrounded && Math.abs(preLandVelY) > 3.5) {
        this.jumpLandAnimTimer = 0.18;
      }
    } else if (
      this.wasGrounded &&
      this.playerVelY <= 0.1 &&
      this.playerPos.y > floorY &&
      this.playerPos.y - floorY <= 0.32
    ) {
      this.playerPos.y = floorY;
      this.playerVelY = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.12;
    } else if (this.playerPos.y > floorY + 0.08) {
      this.isGrounded = false;
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    // Heavy Jump Landing Noise & Breakable Prop Collision
    const horizSpeed = dt > 0.0001 ? Math.hypot(this.playerPos.x - prevX, this.playerPos.z - prevZ) / dt : 0;
    this.lastHorizSpeed = horizSpeed;

    if (!this.wasGrounded && this.isGrounded && Math.abs(preLandVelY) > 6.2) {
      const impactMag = Math.abs(preLandVelY);
      const silentLanding =
        this.hasSkill('ofu_3') ||
        this.hasSkill('rap_3b') ||
        this.mistFormTimer > 0 ||
        (crouchActive && impactMag < 10.2);
      if (!silentLanding) {
        const landIntensity = THREE.MathUtils.clamp((impactMag - 4.8) * 10.5, 34, 92) * this.weatherNoiseMult;
        const landRadius = THREE.MathUtils.clamp(5.8 + (impactMag - 5.5) * 1.1, 6.0, 14.5) * this.weatherNoiseMult;
        this.audio.playHeavyLanding(landIntensity / 100);
        this.emitSoundEvent(this.playerPos, landRadius, landIntensity, 0x94a3b8);
      }
    }

    for (const prop of this.world.breakables) {
      if (prop.broken) continue;
      const dist = Math.hypot(this.playerPos.x - prop.position.x, this.playerPos.z - prop.position.z);
      const dy = Math.abs(this.playerPos.y - prop.position.y);
      if (dist < 0.92 && dy < 1.25) {
        if ((!crouchActive && horizSpeed > 3.6) || (!this.isGrounded && Math.abs(preLandVelY) > 3.5)) {
          this.breakProp(prop);
        }
      }
    }

    // Compute real-time Noise Level (0..100) from movement velocity, stance, Ofuscação & rain dampening
    let continuousNoise = 0;
    const obfNoiseMult =
      this.mistFormTimer > 0 ? 0 : this.obfuscateTimer > 0 ? (this.hasSkill('ofu_3') ? 0 : 0.2) : 1.0;

    if (this.batFormTimer > 0) {
      continuousNoise = 22 * this.weatherNoiseMult * obfNoiseMult;
    } else if (this.dashTimer > 0) {
      continuousNoise = 28 * this.weatherNoiseMult * obfNoiseMult;
    } else if (this.isGrounded && horizSpeed > 0.6) {
      const speedNorm = THREE.MathUtils.clamp(horizSpeed / 6.4, 0, 1.15);
      if (crouchActive) {
        continuousNoise = (this.hasSkill('ofu_1') ? 0 : 14 * speedNorm) * this.weatherNoiseMult * obfNoiseMult;
      } else {
        const cloakMult = this.hasSkill('ofu_3') ? 0 : this.hasSkill('ofu_1') ? 0.62 : 1.0;
        continuousNoise = 56 * speedNorm * cloakMult * this.weatherNoiseMult * obfNoiseMult;
      }
    }

    this.footstepSoundCooldown = Math.max(0, this.footstepSoundCooldown - dt);
    if (continuousNoise >= 30 && this.footstepSoundCooldown <= 0) {
      const stepRadius = (4.6 + (continuousNoise / 100) * 5.2) * this.weatherNoiseMult;
      this.emitSoundEvent(this.playerPos, stepRadius, continuousNoise, 0x94b8ff);
      this.footstepSoundCooldown = 0.42;
    }

    this.noisePulse = Math.max(0, this.noisePulse - 68 * dt);
    const targetNoise = Math.max(continuousNoise, this.noisePulse);
    this.noiseLevel = THREE.MathUtils.damp(this.noiseLevel, THREE.MathUtils.clamp(targetNoise, 0, 100), 12, dt);

    // Animate Articulated Vampire Rig (spine twist, forearm bends, knee flexion, stealth hunch & Obfuscate/Mist/Shroud)
    this.vampire.root.position.copy(this.playerPos);
    this.vampire.root.rotation.y = this.playerYaw;

    const batActive = this.batFormTimer > 0;
    const isFirstPersonView = this.phase === 'playing' && !this.astralActive;
    this.vampire.bodyPivot.visible = !batActive && !isFirstPersonView;
    this.vampire.contactShadow.visible = !isFirstPersonView;
    this.vampire.batRing.visible = batActive;
    if (batActive) {
      this.vampire.batRing.rotation.y += dt * 7.5;
    }

    const isObfActive = this.obfuscateTimer > 0;
    const isMistActive = this.mistFormTimer > 0;
    const isShroudActive = this.abyssalShroudTimer > 0;
    const isVisageActive = this.falseVisageTimer > 0;
    const desiredOpacity = isMistActive
      ? 0.24
      : isObfActive
      ? 0.34
      : this.shadowVeilTimer > 0
      ? 0.42
      : 1.0;
    for (const def of this.vampire.stealthMatDefaults) {
      if (isMistActive) {
        def.mat.color.lerp(_color.setHex(0xcbd5e1), Math.min(1, realDt * 9));
        def.mat.emissive.lerp(_color2.setHex(0x475569), Math.min(1, realDt * 9));
        def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0.32, 9, realDt);
      } else if (isObfActive) {
        def.mat.color.lerp(_color.setHex(0x38bdf8), Math.min(1, realDt * 8));
        def.mat.emissive.lerp(_color2.setHex(0x1d4ed8), Math.min(1, realDt * 8));
        def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0.42, 8, realDt);
      } else if (isShroudActive) {
        def.mat.color.lerp(_color.setHex(0x111322), Math.min(1, realDt * 8));
        def.mat.emissive.lerp(_color2.setHex(0x312e81), Math.min(1, realDt * 8));
        def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0.36, 8, realDt);
      } else if (isVisageActive) {
        def.mat.color.lerp(_color.setHex(def.baseColor), Math.min(1, realDt * 10));
        def.mat.emissive.lerp(_color2.setHex(0x78350f), Math.min(1, realDt * 8));
        def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0.22, 8, realDt);
      } else {
        def.mat.color.lerp(_color.setHex(def.baseColor), Math.min(1, realDt * 10));
        def.mat.emissive.lerp(_color2.setHex(0x000000), Math.min(1, realDt * 10));
        def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0, 10, realDt);
      }
      def.mat.opacity = THREE.MathUtils.damp(def.mat.opacity, desiredOpacity, 10, realDt);
    }

    const landSquash = this.jumpLandAnimTimer > 0 ? Math.sin((this.jumpLandAnimTimer / 0.18) * Math.PI) * 0.16 : 0;
    const airStretch = !this.isGrounded ? THREE.MathUtils.clamp(this.playerVelY * 0.012, -0.05, 0.08) : 0;
    const targetScaleY = 1.0 - landSquash + airStretch;
    this.vampire.bodyPivot.scale.y = THREE.MathUtils.damp(
      this.vampire.bodyPivot.scale.y,
      targetScaleY,
      14,
      dt,
    );
    const crouchDropY = crouchActive && this.isGrounded ? -0.24 : 0;
    this.vampire.bodyPivot.position.y = THREE.MathUtils.damp(
      this.vampire.bodyPivot.position.y,
      crouchDropY,
      14,
      dt,
    );

    const isMoving = horizSpeed > 0.35;
    const stride = Math.sin(this.walkCycle) * (crouchActive ? 0.34 : 0.56);
    const idleBreath = Math.sin(this.sharedUniforms.uTime.value * 2.1) * 0.035;

    let targetBodyPitch = 0;
    let targetSpineX = crouchActive && this.isGrounded ? 0.56 : isMoving ? 0.12 : idleBreath;
    let targetSpineY = isMoving ? Math.sin(this.walkCycle) * 0.09 : 0;
    let targetHeadX = crouchActive && this.isGrounded ? -0.42 : 0;
    let targetLeftLeg = crouchActive && this.isGrounded ? -0.68 + stride * 0.48 : stride;
    let targetRightLeg = crouchActive && this.isGrounded ? -0.68 - stride * 0.48 : -stride;
    let targetLeftShin =
      crouchActive && this.isGrounded
        ? 1.06 + (isMoving ? Math.max(0, -Math.cos(this.walkCycle)) * 0.32 : 0)
        : isMoving
        ? Math.max(0, -Math.cos(this.walkCycle)) * 0.65
        : 0.06;
    let targetRightShin =
      crouchActive && this.isGrounded
        ? 1.06 + (isMoving ? Math.max(0, Math.cos(this.walkCycle)) * 0.32 : 0)
        : isMoving
        ? Math.max(0, Math.cos(this.walkCycle)) * 0.65
        : 0.06;
    let targetLeftArmX = crouchActive && this.isGrounded ? -0.25 - stride * 0.45 : -stride * 0.65;
    let targetRightArmX = crouchActive && this.isGrounded ? -0.25 + stride * 0.45 : stride * 0.65;
    let targetLeftArmZ = crouchActive ? -0.18 : -0.05;
    let targetRightArmZ = crouchActive ? 0.18 : 0.05;
    let targetLeftForearmX = crouchActive ? -0.78 : isMoving ? -0.45 : -0.22;
    let targetRightForearmX = crouchActive ? -0.78 : isMoving ? -0.45 : -0.22;
    let targetCapeX = crouchActive && this.isGrounded
      ? 0.36 + Math.abs(stride) * 0.25
      : 0.06 + Math.abs(stride) * 0.32 + (this.celerityTimer > 0 && isMoving ? 0.28 : 0);
    let targetCapeZ = crouchActive && this.isGrounded ? Math.sin(this.walkCycle) * 0.06 : 0;

    if (!this.isGrounded) {
      if (this.playerVelY > 1.2) {
        // Jump launch / ascending pose
        targetBodyPitch = 0.12;
        targetSpineX = 0.18;
        targetLeftLeg = -0.72;
        targetRightLeg = 0.32;
        targetLeftShin = 0.82;
        targetRightShin = 0.34;
        targetLeftArmX = 0.45;
        targetRightArmX = 0.38;
        targetLeftForearmX = -0.55;
        targetRightForearmX = -0.55;
        targetLeftArmZ = -0.22;
        targetRightArmZ = 0.22;
        targetCapeX = 0.74;
      } else {
        // Apex / gothic predator descent pose
        targetBodyPitch = 0.18;
        targetSpineX = 0.26;
        targetLeftLeg = -0.34;
        targetRightLeg = 0.24;
        targetLeftShin = 0.56;
        targetRightShin = 0.44;
        targetLeftArmX = -0.54;
        targetRightArmX = -0.54;
        targetLeftForearmX = -0.38;
        targetRightForearmX = -0.38;
        targetLeftArmZ = -0.38;
        targetRightArmZ = 0.38;
        targetCapeX = 0.98;
      }
    } else if (this.dashTimer > 0) {
      targetBodyPitch = 0.24;
      targetSpineX = 0.35;
      targetLeftForearmX = -0.4;
      targetRightForearmX = -0.4;
      targetCapeX = 0.96;
    }

    if (this.castAnimTimer > 0) {
      targetSpineX = -0.14;
      targetLeftArmX = -1.28;
      targetRightArmX = -1.28;
      targetLeftForearmX = -0.45;
      targetRightForearmX = -0.45;
      targetLeftArmZ = -0.32;
      targetRightArmZ = 0.32;
    }

    let targetSpineZ = 0;

    if (this.clawSlashTimer > 0) {
      const slashProg = 1 - this.clawSlashTimer / Math.max(0.05, this.clawSlashDuration);
      const arc = Math.min(1, slashProg * 1.35);
      const ease = 1 - Math.pow(1 - arc, 3);
      const step = this.clawActiveComboStep;

      if (step === 0) {
        // Combo 1: Right-arm sweeping cross-slash + left counter-balance
        targetSpineY = 0.48 - ease * 1.06;
        targetSpineX = 0.24 + Math.sin(ease * Math.PI) * 0.14;
        targetSpineZ = -0.1 + ease * 0.2;
        this.vampire.rightArm.rotation.set(
          -1.92 + ease * 1.62,
          -0.32 + ease * 0.88,
          0.68 - ease * 0.92,
        );
        this.vampire.rightForearm.rotation.x = -0.82 + ease * 0.52;
        this.vampire.leftArm.rotation.set(-0.35 + ease * 0.78, 0, -0.26);
        this.vampire.leftForearm.rotation.x = -0.68;
        targetCapeX = 0.54 + Math.sin(slashProg * Math.PI) * 0.5;
        targetCapeZ = 0.24 * (1 - ease * 1.8);
      } else if (step === 1) {
        // Combo 2: Left-arm sweeping cross-slash + right counter-balance
        targetSpineY = -0.5 + ease * 1.08;
        targetSpineX = 0.26 + Math.sin(ease * Math.PI) * 0.14;
        targetSpineZ = 0.1 - ease * 0.2;
        this.vampire.leftArm.rotation.set(
          -1.92 + ease * 1.62,
          0.32 - ease * 0.88,
          -0.68 + ease * 0.92,
        );
        this.vampire.leftForearm.rotation.x = -0.82 + ease * 0.52;
        this.vampire.rightArm.rotation.set(-0.35 + ease * 0.78, 0, 0.26);
        this.vampire.rightForearm.rotation.x = -0.68;
        targetCapeX = 0.58 + Math.sin(slashProg * Math.PI) * 0.52;
        targetCapeZ = -0.24 * (1 - ease * 1.8);
      } else {
        // Combo 3: Double-claw predatory lunge
        targetBodyPitch = 0.15 * Math.sin(slashProg * Math.PI);
        targetSpineY = 0;
        targetSpineX = 0.12 + ease * 0.36;
        targetSpineZ = 0;
        targetHeadX = -0.2 * ease;
        this.vampire.leftArm.rotation.set(
          -2.05 + ease * 1.82,
          -0.25 + ease * 0.65,
          -0.72 + ease * 0.54,
        );
        this.vampire.rightArm.rotation.set(
          -2.05 + ease * 1.82,
          0.25 - ease * 0.65,
          0.72 - ease * 0.54,
        );
        this.vampire.leftForearm.rotation.x = -0.92 + ease * 0.68;
        this.vampire.rightForearm.rotation.x = -0.92 + ease * 0.68;
        targetCapeX = 0.66 + Math.sin(slashProg * Math.PI) * 0.56;
        targetCapeZ = Math.sin(slashProg * Math.PI * 2) * 0.1;
      }
    } else {
      this.vampire.leftArm.rotation.x = THREE.MathUtils.damp(this.vampire.leftArm.rotation.x, targetLeftArmX, 12, dt);
      this.vampire.rightArm.rotation.x = THREE.MathUtils.damp(this.vampire.rightArm.rotation.x, targetRightArmX, 12, dt);
      this.vampire.leftArm.rotation.y = THREE.MathUtils.damp(this.vampire.leftArm.rotation.y, 0, 14, dt);
      this.vampire.rightArm.rotation.y = THREE.MathUtils.damp(this.vampire.rightArm.rotation.y, 0, 14, dt);
      this.vampire.leftArm.rotation.z = THREE.MathUtils.damp(this.vampire.leftArm.rotation.z, targetLeftArmZ, 12, dt);
      this.vampire.rightArm.rotation.z = THREE.MathUtils.damp(this.vampire.rightArm.rotation.z, targetRightArmZ, 12, dt);
      this.vampire.leftForearm.rotation.x = THREE.MathUtils.damp(
        this.vampire.leftForearm.rotation.x,
        targetLeftForearmX,
        14,
        dt,
      );
      this.vampire.rightForearm.rotation.x = THREE.MathUtils.damp(
        this.vampire.rightForearm.rotation.x,
        targetRightForearmX,
        14,
        dt,
      );
    }

    const comboSnapRate = this.clawSlashTimer > 0 ? 22 : 12;
    this.vampire.bodyPivot.rotation.x = THREE.MathUtils.damp(this.vampire.bodyPivot.rotation.x, targetBodyPitch, comboSnapRate, dt);
    this.vampire.spinePivot.rotation.x = THREE.MathUtils.damp(this.vampire.spinePivot.rotation.x, targetSpineX, comboSnapRate, dt);
    this.vampire.spinePivot.rotation.y = THREE.MathUtils.damp(this.vampire.spinePivot.rotation.y, targetSpineY, comboSnapRate, dt);
    this.vampire.spinePivot.rotation.z = THREE.MathUtils.damp(this.vampire.spinePivot.rotation.z, targetSpineZ, comboSnapRate, dt);
    this.vampire.head.rotation.x = THREE.MathUtils.damp(this.vampire.head.rotation.x, targetHeadX, comboSnapRate, dt);
    this.vampire.leftLeg.rotation.x = THREE.MathUtils.damp(this.vampire.leftLeg.rotation.x, targetLeftLeg, 14, dt);
    this.vampire.rightLeg.rotation.x = THREE.MathUtils.damp(this.vampire.rightLeg.rotation.x, targetRightLeg, 14, dt);
    this.vampire.leftShin.rotation.x = THREE.MathUtils.damp(this.vampire.leftShin.rotation.x, targetLeftShin, 14, dt);
    this.vampire.rightShin.rotation.x = THREE.MathUtils.damp(this.vampire.rightShin.rotation.x, targetRightShin, 14, dt);

    const capeSnapRate = this.clawSlashTimer > 0 ? 18 : 10;
    this.vampire.cape.rotation.x = THREE.MathUtils.damp(this.vampire.cape.rotation.x, targetCapeX, capeSnapRate, dt);
    this.vampire.cape.rotation.z = THREE.MathUtils.damp(this.vampire.cape.rotation.z, targetCapeZ, capeSnapRate, dt);
    this.vampire.contactShadow.position.y = Math.max(0.02, floorY - this.playerPos.y + 0.02);

    // Compute Stealth Exposure (0..100)
    let rawExposure = 14;
    for (const lamp of this.world.lamps) {
      if (!lamp.isLit) continue;
      const vertDiff = Math.max(0, this.playerPos.y - 4.2);
      const horizDist = Math.hypot(this.playerPos.x - lamp.position.x, this.playerPos.z - lamp.position.z);
      if (horizDist < 8.5 && vertDiff < 2.6) {
        rawExposure += (1 - horizDist / 8.5) * 82 * (1 - vertDiff / 2.6);
      }
    }
    for (const sz of this.world.shadowZones) {
      const distSq = (this.playerPos.x - sz.x) ** 2 + (this.playerPos.z - sz.z) ** 2;
      if (distSq < sz.radius * sz.radius && Math.abs(this.playerPos.y - sz.y) < 2.2) {
        rawExposure *= 0.32;
      }
    }
    if (this.playerPos.y >= 5.5) rawExposure *= 0.55;
    if (crouchActive) rawExposure *= 0.48;
    if (this.weather === 'fog') rawExposure *= 0.84;
    const cloakReduction = this.hasSkill('ofu_3') ? 0.4 : this.hasSkill('ofu_1') ? 0.68 : 1.0;
    rawExposure *= cloakReduction;
    if (
      this.dashTimer > 0 ||
      this.shadowVeilTimer > 0 ||
      this.abyssalShroudTimer > 0 ||
      this.batFormTimer > 0 ||
      this.mistFormTimer > 0 ||
      this.obfuscateTimer > 0 ||
      this.isNearSafeSanctuary(this.playerPos)
    ) {
      rawExposure = 0;
    }

    this.exposure = THREE.MathUtils.damp(this.exposure, THREE.MathUtils.clamp(rawExposure, 0, 100), 8, dt);
  }

  private computeMoveDirection(out: THREE.Vector3): void {
    let f = 0;
    let r = 0;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) f += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) f -= 1;
    if (this.heldKeys.has('KeyD')) r += 1;
    if (this.heldKeys.has('KeyA')) r -= 1;

    if (f === 0 && r === 0) {
      out.set(0, 0, 0);
      return;
    }
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    out.set(-sin * f + cos * r, 0, -cos * f - sin * r);
  }

  private findNearbyExposedCorpse(): NpcEntity | null {
    for (const npc of this.npcs) {
      if (npc.state === 'drained' && !npc.corpseHidden && npc.rig.root.visible) {
        if (npc.position.distanceTo(this.playerPos) <= 2.9) {
          return npc;
        }
      }
    }
    return null;
  }

  private findFeedCandidate(): { npc: NpcEntity; isStealth: boolean; isAerial: boolean } | null {
    const baseReach = 2.55 + (this.hasSkill('met_1') ? 1.4 : 0);
    const hasCornicePlunge = this.hasSkill('rap_3b') || this.hasSkill('amal_nocturnal_stalker');
    const maxVertGap = this.hasSkill('amal_nocturnal_stalker') ? 13.0 : hasCornicePlunge ? 11.5 : 7.5;
    const minVertGap = hasCornicePlunge ? 1.35 : 1.6;
    const maxAerialHoriz = hasCornicePlunge ? 5.5 : 3.8;
    let best: NpcEntity | null = null;
    let bestScore = Infinity;
    let bestStealth = false;
    let bestAerial = false;

    for (const npc of this.npcs) {
      if (npc.state === 'drained') continue;
      if (npc === this.feedTarget) continue;

      const horizDist = Math.hypot(npc.position.x - this.playerPos.x, npc.position.z - this.playerPos.z);
      const vertGap = this.playerPos.y - npc.position.y;
      const isAerial =
        vertGap >= minVertGap &&
        vertGap <= maxVertGap &&
        horizDist <= maxAerialHoriz &&
        (horizDist <= 3.8 || hasLineOfSight(this.playerPos, npc.position, this.world.volumes));

      if (!isAerial && (horizDist > baseReach || Math.abs(vertGap) > 1.7)) continue;

      const isGuardTier =
        npc.archetype === 'guard' || npc.archetype === 'bodyguard' || npc.archetype === 'hunter';
      const canAssassinateGuard =
        !isGuardTier ||
        isAerial ||
        npc.hp <= 25 ||
        npc.state === 'patrol' ||
        npc.state === 'resting' ||
        npc.state === 'curious' ||
        npc.state === 'stunned' ||
        npc.state === 'possessed' ||
        (npc.state === 'suspicious' && this.hasSkill('met_3'));

      if (!canAssassinateGuard) continue;

      const playerCloaked =
        this.obfuscateTimer > 0 || this.abyssalShroudTimer > 0 || this.shadowVeilTimer > 0;
      const npcUnaware =
        npc.state === 'patrol' ||
        npc.state === 'resting' ||
        npc.state === 'curious' ||
        npc.state === 'stunned' ||
        npc.state === 'possessed' ||
        (npc.state === 'suspicious' && (!isGuardTier || this.hasSkill('met_3')));

      if (horizDist < bestScore) {
        best = npc;
        bestScore = horizDist;
        bestStealth = isAerial || playerCloaked || npcUnaware;
        bestAerial = isAerial;
      }
    }
    return best ? { npc: best, isStealth: bestStealth, isAerial: bestAerial } : null;
  }

  private updateNpcVisionConeMesh(
    npc: NpcEntity,
    effectiveRange: number,
    halfFov: number,
  ): void {
    const geo = npc.rig.visionConeGeo;
    if (!geo) return;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const sinY = Math.sin(npc.yaw);
    const cosY = Math.cos(npc.yaw);
    const rayY = npc.position.y + 1.1;

    for (let i = 0; i <= VISION_CONE_RAYS; i++) {
      const t = i / VISION_CONE_RAYS;
      const localAngle = -halfFov + t * (halfFov * 2);
      const localDirX = Math.sin(localAngle);
      const localDirZ = Math.cos(localAngle);

      const worldDirX = localDirX * cosY + localDirZ * sinY;
      const worldDirZ = -localDirX * sinY + localDirZ * cosY;

      let hitDist = effectiveRange;
      for (let vIdx = 0; vIdx < this.world.volumes.length; vIdx++) {
        const vol = this.world.volumes[vIdx];
        if (!vol.blocksSight) continue;
        if (rayY < vol.minY || rayY > vol.maxY) continue;
        const d = raycastAabb2D(npc.position.x, npc.position.z, worldDirX, worldDirZ, hitDist, vol);
        if (d < hitDist) hitDist = d;
      }

      posAttr.setXYZ(i + 1, localDirX * hitDist, 0.045, localDirZ * hitDist);
    }
    posAttr.needsUpdate = true;
  }

  private findNearestActiveBell(pos: THREE.Vector3, maxRange: number): AlarmBellInstance | null {
    let best: AlarmBellInstance | null = null;
    let bestDist = maxRange;
    for (const bell of this.world.bells) {
      if (bell.sabotaged || bell.cooldown > 0) continue;
      const d = bell.position.distanceTo(pos);
      if (d < bestDist) {
        best = bell;
        bestDist = d;
      }
    }
    return best;
  }

  private updateNpcs(dt: number): void {
    const playerHidden =
      this.dashTimer > 0 ||
      this.shadowVeilTimer > 0 ||
      this.abyssalShroudTimer > 0 ||
      this.batFormTimer > 0 ||
      this.mistFormTimer > 0 ||
      this.obfuscateTimer > 0;
    const isFeeding = this.feedTimer > 0;
    const isFootstepLoud =
      !this.isCrouching &&
      !this.heldKeys.has('ShiftLeft') &&
      !this.hasSkill('ofu_3') &&
      this.mistFormTimer <= 0 &&
      !(this.obfuscateTimer > 0 && this.hasSkill('ofu_2a')) &&
      (this.heldKeys.has('KeyW') ||
        this.heldKeys.has('KeyS') ||
        this.heldKeys.has('KeyA') ||
        this.heldKeys.has('KeyD'));

    // Rain slightly narrows guard peripheral sight
    const guardCosThreshold =
      this.weather === 'rain' ? Math.cos(GUARD_HALF_FOV * 0.88) : Math.cos(GUARD_HALF_FOV);

    // Global suspicion escalates guard speed, sight range & attack cadence!
    const susSpeedMult = 1 + (this.globalSuspicion / 100) * 0.42;
    const susSightMult = 1 + (this.globalSuspicion / 100) * 0.32;
    const susRateMult = 1 + (this.globalSuspicion / 100) * 0.65;
    const senseVal = this.sharedUniforms.uCrimsonSense.value;
    const auspRange = this.hasSkill('aus_2a') ? 52 : 36;
    const isPlayerStealth =
      this.isCrouching ||
      this.obfuscateTimer > 0 ||
      this.shadowVeilTimer > 0 ||
      this.abyssalShroudTimer > 0;
    const playerSafeCemetery = this.isInSafeCemetery(this.playerPos);

    for (const npc of this.npcs) {
      if (npc.state === 'drained') {
        npc.rig.crimsonPulseMesh.visible = false;
        if (npc.rig.visionCone) npc.rig.visionCone.visible = false;

        // Weighted defeat collapse animation onto the cobblestones
        if (npc.rig.root.visible && npc.deathFallTimer > 0) {
          npc.deathFallTimer = Math.max(0, npc.deathFallTimer - dt);
          const p = 1 - npc.deathFallTimer / 0.45;
          const fallCurve =
            p < 0.8
              ? Math.pow(p / 0.8, 2.0)
              : 1.0 - Math.sin(((p - 0.8) / 0.2) * Math.PI) * 0.08;
          npc.rig.bodyGroup.rotation.x = THREE.MathUtils.lerp(
            npc.deathFallStartRotX,
            Math.PI / 2,
            fallCurve,
          );
          npc.rig.bodyGroup.position.y = THREE.MathUtils.lerp(
            npc.deathFallStartY,
            0.22,
            fallCurve,
          );
          npc.rig.bodyGroup.rotation.z = THREE.MathUtils.damp(
            npc.rig.bodyGroup.rotation.z,
            npc.hitRecoilDir * 0.14,
            10,
            dt,
          );
          npc.rig.leftArm.rotation.x = THREE.MathUtils.damp(npc.rig.leftArm.rotation.x, -0.35, 10, dt);
          npc.rig.rightArm.rotation.x = THREE.MathUtils.damp(npc.rig.rightArm.rotation.x, 0.28, 10, dt);
          npc.rig.leftArm.rotation.z = THREE.MathUtils.damp(npc.rig.leftArm.rotation.z, -0.25, 10, dt);
          npc.rig.rightArm.rotation.z = THREE.MathUtils.damp(npc.rig.rightArm.rotation.z, 0.25, 10, dt);
          if (npc.deathFallTimer <= 0) {
            npc.rig.bodyGroup.rotation.x = Math.PI / 2;
            npc.rig.bodyGroup.position.y = 0.22;
          }
        }

        npc.respawnTimer -= dt;
        if (npc.respawnTimer <= 0) {
          npc.state = 'patrol';
          npc.hp = npc.maxHp;
          npc.suspicion = 0;
          npc.investigateArrived = false;
          npc.restTimer = 0;
          npc.restCooldown = 8 + Math.random() * 8;
          npc.shiftTimer = 0;
          npc.attackWindup = 0;
          npc.attackSwingTimer = 0;
          npc.hitStaggerTimer = 0;
          npc.deathFallTimer = 0;
          npc.steerAngleOffset = 0;
          npc.stuckTimer = 0;
          npc.targetBell = null;
          npc.corpseHidden = false;
          npc.corpseDiscovered = false;
          npc.rig.bodyGroup.rotation.set(0, 0, 0);
          npc.rig.bodyGroup.position.y = 0;
          npc.rig.leftArm.rotation.set(0, 0, 0);
          npc.rig.rightArm.rotation.set(0, 0, 0);
          npc.rig.leftLeg.rotation.set(0, 0, 0);
          npc.rig.rightLeg.rotation.set(0, 0, 0);
          if (npc.escortTarget && npc.escortTarget.state !== 'drained') {
            npc.position.copy(npc.escortTarget.position).add(_v1.set(1.5, 0, -1.5));
          } else {
            npc.position.copy(npc.route[0]);
          }
          npc.waypointIndex = 1 % npc.route.length;
          npc.rig.root.position.copy(npc.position);
          npc.rig.root.visible = true;
        }
        continue;
      }

      npc.frameMoveDirX = 0;
      npc.frameMoveDirZ = 0;
      npc.frameMoveSpeed = 0;
      npc.frameIsMoving = false;

      const isGuardRole =
        npc.archetype === 'guard' || npc.archetype === 'bodyguard' || npc.archetype === 'hunter';
      npc.attackCooldown = Math.max(0, npc.attackCooldown - dt);
      npc.attackSwingTimer = Math.max(0, npc.attackSwingTimer - dt);
      npc.boltCooldown = Math.max(0, npc.boltCooldown - dt);
      npc.hitStaggerTimer = Math.max(0, npc.hitStaggerTimer - dt);
      npc.restCooldown = Math.max(0, npc.restCooldown - dt);

      const horizDist = Math.hypot(this.playerPos.x - npc.position.x, this.playerPos.z - npc.position.z);
      const vertDiff = Math.abs(this.playerPos.y - npc.position.y);

      // Subtle red heartbeat pulses (golden-amber for the Main Target of the Night) visible through walls in Crimson Sense
      if (senseVal > 0.04 && horizDist <= auspRange) {
        npc.rig.crimsonPulseMesh.visible = true;
        npc.rig.crimsonPulseMat.color.setHex(npc.isMainTarget ? 0xfbbf24 : 0xdc2626);
        npc.rig.crimsonPulseMat.opacity =
          senseVal *
          ((npc.isMainTarget ? 0.24 : 0.14) +
            0.16 * (0.5 + 0.5 * Math.sin(this.sharedUniforms.uTime.value * 5.2 + npc.id)));
      } else {
        npc.rig.crimsonPulseMesh.visible = false;
      }

      // Update guard/bodyguard overhead HP bar when damaged
      if (isGuardRole && npc.hp < npc.maxHp) {
        npc.rig.hpBarGroup.visible = true;
        npc.rig.hpBarGroup.lookAt(this.camera.position);
        const hpRatio = Math.max(0.02, npc.hp / npc.maxHp);
        npc.rig.hpBarFill.scale.x = hpRatio;
        npc.rig.hpBarFill.position.x = -(1 - hpRatio) * 0.43;
      } else {
        npc.rig.hpBarGroup.visible = false;
      }

      // Expressive Victim Reaction while being drained (neck exposed, trembling, limp slump)
      if (isFeeding && npc === this.feedTarget) {
        const feedProg = THREE.MathUtils.clamp(
          1 - this.feedTimer / Math.max(0.05, this.feedDuration),
          0,
          1,
        );
        if (this.feedTakedownKind === 'noble') {
          _v1.subVectors(this.playerPos, npc.position);
          const faceYaw = Math.atan2(_v1.x, _v1.z);
          let yDiff = faceYaw - npc.yaw;
          while (yDiff > Math.PI) yDiff -= Math.PI * 2;
          while (yDiff < -Math.PI) yDiff += Math.PI * 2;
          npc.yaw += yDiff * Math.min(1, dt * 12);
        }
        const t = this.sharedUniforms.uTime.value;
        const neckExpose = -0.32 * Math.sin(Math.min(1, feedProg * 1.45) * Math.PI * 0.5);
        npc.rig.bodyGroup.rotation.x = neckExpose;
        npc.rig.bodyGroup.rotation.z = Math.sin(t * 30 + npc.id) * 0.042 * (1 - feedProg * 0.35);
        npc.rig.bodyGroup.position.y = -0.04 - feedProg * 0.14;
        npc.rig.leftArm.rotation.x = 0.38 + Math.sin(t * 15) * 0.14;
        npc.rig.rightArm.rotation.x = 0.46 - Math.cos(t * 15) * 0.14;
        if (npc.rig.visionCone) npc.rig.visionCone.visible = false;
        continue;
      }

      if (npc.hitStaggerTimer > 0) {
        if (npc.rig.visionCone) npc.rig.visionCone.visible = false;
        continue;
      }

      if (npc.state === 'stunned') {
        npc.stateTimer -= dt;
        if (npc.rig.visionCone) npc.rig.visionCone.visible = false;
        if (npc.stateTimer <= 0) {
          npc.rig.bodyGroup.rotation.z = 0;
          npc.state = 'patrol';
        }
        continue;
      }

      if (npc.state === 'possessed') {
        npc.possessTimer -= dt;
        if (npc.rig.visionCone) npc.rig.visionCone.visible = false;
        const distPos = Math.hypot(npc.possessPos.x - npc.position.x, npc.possessPos.z - npc.position.z);
        if (distPos > 0.6) {
          _v1.set(npc.possessPos.x - npc.position.x, 0, npc.possessPos.z - npc.position.z).normalize();
          const pSpeed = npc.speed * 1.15;
          npc.position.addScaledVector(_v1, pSpeed * dt);
          npc.frameMoveDirX = _v1.x;
          npc.frameMoveDirZ = _v1.z;
          npc.frameMoveSpeed = pSpeed;
          npc.frameIsMoving = true;
          npc.yaw = Math.atan2(_v1.x, _v1.z);
          npc.walkPhase += dt * pSpeed * 2.8;
        }

        for (const other of this.npcs) {
          if (
            other !== npc &&
            (other.archetype === 'guard' || other.archetype === 'bodyguard' || other.archetype === 'hunter') &&
            other.state === 'patrol' &&
            other.position.distanceTo(npc.position) < 9.5
          ) {
            other.state = 'curious';
            other.suspicion = Math.max(other.suspicion, 0.28);
            other.stateTimer = 4.2;
            other.investigateArrived = false;
            other.investigatePos.copy(npc.position);
          }
        }

        if (npc.possessTimer <= 0) {
          npc.state = 'patrol';
          npc.suspicion = 0;
          npc.waypointIndex = this.pickBestWaypoint(npc);
        }
        continue;
      }

      const showConeForNpc =
        (senseVal > 0.08 && horizDist <= auspRange) ||
        (isPlayerStealth && horizDist <= 24.0) ||
        horizDist <= 14.5;
      if (npc.rig.visionCone) npc.rig.visionCone.visible = showConeForNpc;

      // Register encounter & tactical observations for Grimoire Dossier
      if (
        npc.archetype === 'noble' ||
        npc.archetype === 'guard' ||
        npc.archetype === 'hunter' ||
        npc.archetype === 'cultist'
      ) {
        const detectRange = this.isCrimsonSense ? 26 : 15;
        if (horizDist <= detectRange && (this.isCrimsonSense || hasLineOfSight(this.playerPos, npc.position, this.world.volumes))) {
          this.registerEncounter(npc, !this.encounteredTargets.has(npc.name));
          if (this.isCrimsonSense && horizDist <= 22) {
            const prof = NPC_DOSSIER_PROFILES.find((p) => p.name === npc.name);
            if (prof) this.discoverWeakness(npc.name, prof.weaknesses[0].id);
          }
          if (this.weather === 'fog' && horizDist <= 12) {
            if (npc.name === 'Caçador da Vigília') this.discoverWeakness(npc.name, 'fog_cone');
            if (npc.name === 'Magistrado Vance') this.discoverWeakness(npc.name, 'fog_blind');
          }
          if (this.weather === 'rain' && horizDist <= 10) {
            if (npc.name === 'Inquisidor de Prata') this.discoverWeakness(npc.name, 'rain_muffle');
            if (npc.name === 'Condessa Eleanor') this.discoverWeakness(npc.name, 'rain_approach');
          }
          if (this.playerPos.y - npc.position.y >= 2.8 && horizDist <= 12 && npc.name === 'Sentinela Sacra') {
            this.discoverWeakness(npc.name, 'vertical_blind');
          }
        }
        if (npc.state === 'suspicious' || npc.state === 'curious') {
          if (npc.name === 'Condessa Eleanor') this.discoverWeakness(npc.name, 'sound_lure');
          if (npc.name === 'Alabardeiro') this.discoverWeakness(npc.name, 'suspicion_bait');
          if (npc.name === 'Caçador de Vampiros') this.discoverWeakness(npc.name, 'hunter_lure');
          if (npc.name === 'Boticário') this.discoverWeakness(npc.name, 'sound_curious');
        }
      }

      const roleSightMult =
        npc.archetype === 'hunter' ? 1.18 : npc.archetype === 'bodyguard' ? 1.1 : 1.0;
      const baseSight = isGuardRole
        ? GUARD_VISION_RANGE * susSightMult * this.weatherVisionMult * roleSightMult
        : npc.archetype === 'beggar'
        ? 6.5 * this.weatherVisionMult
        : 9.5 * this.weatherVisionMult;
      const sightCos = isGuardRole ? guardCosThreshold : 0.42;

      const heightPenalty = this.playerPos.y - npc.position.y > 2.8 ? 0.42 : 1.0;
      const effectiveSightRange = baseSight * (0.45 + (this.exposure / 100) * 0.55) * heightPenalty;

      if (showConeForNpc) {
        const coneRange = isGuardRole
          ? GUARD_VISION_RANGE * susSightMult * this.weatherVisionMult * roleSightMult
          : baseSight;
        const coneHalfFov = isGuardRole ? GUARD_HALF_FOV : Math.acos(0.42);
        this.updateNpcVisionConeMesh(npc, coneRange, coneHalfFov);
      }

      let seesPlayer = false;
      const npcInSafeCemetery = this.isInSafeCemetery(npc.position);
      const blockSightInCemetery = playerSafeCemetery && !npcInSafeCemetery;
      const disguisedSafe =
        this.falseVisageTimer > 0 &&
        !isFeeding &&
        npc.state !== 'alert' &&
        npc.state !== 'hunt' &&
        horizDist > 2.2;
      if (!playerHidden && !blockSightInCemetery && !disguisedSafe && horizDist < effectiveSightRange && vertDiff < 6.5) {
        _v1.set(this.playerPos.x - npc.position.x, 0, this.playerPos.z - npc.position.z).normalize();
        _v2.set(Math.sin(npc.yaw), 0, Math.cos(npc.yaw));
        const dot = _v1.dot(_v2);
        if (dot >= sightCos && hasLineOfSight(npc.position, this.playerPos, this.world.volumes)) {
          seesPlayer = true;
        }
      }

      // Check for exposed drained corpses nearby!
      if (npc.state === 'patrol' || npc.state === 'resting') {
        for (const other of this.npcs) {
          if (
            other.state === 'drained' &&
            !other.corpseHidden &&
            !other.corpseDiscovered &&
            other.rig.root.visible
          ) {
            const corpseDist = npc.position.distanceTo(other.position);
            if (corpseDist < 10.5 && hasLineOfSight(npc.position, other.position, this.world.volumes)) {
              other.corpseDiscovered = true;
              this.addGlobalSuspicion(18);
              this.addDistrictInfamy(other.position, 14);
              this.showBanner(`${npc.name} encontrou um corpo exposto! (+18 Suspeita)`, 3.0);
              npc.restTimer = 0;
              if (isGuardRole) {
                npc.state = 'suspicious';
                npc.suspicion = 0.85;
                npc.stateTimer = 7.5;
                npc.investigatePos.copy(other.position);
                npc.targetBell = this.findNearestActiveBell(npc.position, 22);
              } else if (npc.archetype === 'cultist') {
                npc.state = 'curious';
                npc.suspicion = 0.7;
                npc.stateTimer = 6.0;
                npc.investigatePos.copy(other.position);
              } else {
                npc.state = 'flee';
                npc.stateTimer = 8.0;
                if (npc.archetype !== 'beggar') {
                  npc.targetBell = this.findNearestActiveBell(npc.position, 26);
                }
              }
              break;
            }
          }
        }
      }

      // Witnessing Feeding!
      let witnessesFeeding = false;
      if (isFeeding && npc !== this.feedTarget && vertDiff < 4.5 && !playerHidden) {
        const feedSightDist = 15.5;
        const feedHearDist = this.hasSkill('ofu_1') ? 3.2 : 6.8;
        if (horizDist <= feedHearDist) {
          witnessesFeeding = true;
        } else if (horizDist <= feedSightDist) {
          _v1.set(this.playerPos.x - npc.position.x, 0, this.playerPos.z - npc.position.z).normalize();
          _v2.set(Math.sin(npc.yaw), 0, Math.cos(npc.yaw));
          if (_v1.dot(_v2) > -0.15 && hasLineOfSight(npc.position, this.playerPos, this.world.volumes)) {
            witnessesFeeding = true;
          }
        }
      }

      if (witnessesFeeding) {
        this.feedWitnessed = true;
      }

      const hearsPlayer =
        !playerHidden && isFootstepLoud && horizDist < 4.4 * this.weatherNoiseMult && vertDiff < 2.2;

      // Bodyguard defends escorted Noble immediately if player threatens them!
      const escortThreatened =
        npc.archetype === 'bodyguard' &&
        npc.escortTarget &&
        npc.escortTarget.state !== 'drained' &&
        (npc.escortTarget === this.feedTarget ||
          npc.escortTarget.state === 'flee' ||
          (npc.escortTarget.state === 'curious' && horizDist < 9.5 && !playerHidden));

      if (isGuardRole) {
        // Patrol shift rotation (regular ground guards rotate across adjacent city sectors)
        if (npc.archetype === 'guard' && npc.state === 'patrol' && npc.route[0].y < 1.5) {
          npc.shiftTimer += dt;
          if (npc.shiftTimer >= npc.shiftDuration) {
            npc.shiftTimer = 0;
            const groundRoutes = this.world.guardRoutes.filter((r) => r[0].y < 1.5);
            const curIdx = groundRoutes.indexOf(npc.route);
            if (groundRoutes.length > 1) {
              const nextRoute = groundRoutes[(Math.max(0, curIdx) + 1) % groundRoutes.length];
              if (nextRoute !== npc.route) {
                npc.route = nextRoute;
                npc.waypointIndex = this.pickBestWaypoint(npc);
              }
            }
          }
        }

        if (witnessesFeeding || escortThreatened) {
          npc.restTimer = 0;
          npc.suspicion = 1;
          npc.investigatePos.copy(this.playerPos);
          if (npc.state !== 'hunt') {
            npc.state = 'hunt';
            npc.stateTimer = 11.0;
            this.audio.playSuspicionCue('alert');
            this.addGlobalSuspicion(14);
            npc.targetBell = npc.archetype === 'guard' ? this.findNearestActiveBell(npc.position, 16) : null;
            this.showBanner(
              escortThreatened
                ? 'Guarda-Costas detectou ameaça ao nobre — Caça Total!'
                : 'Caçador flagrou você se alimentando!',
              2.5,
            );
          }
        } else if (seesPlayer) {
          npc.restTimer = 0;
          const playerInDark = this.exposure < 32 || this.isPositionInShadow(this.playerPos);
          const darknessSusMult = playerInDark ? 0.34 : 1.0;
          const fillRate =
            (0.75 + (this.exposure / 100) * 1.45) *
            (1 - horizDist / (baseSight * 1.35)) *
            susRateMult *
            darknessSusMult;
          npc.suspicion = Math.min(1, npc.suspicion + Math.max(playerInDark ? 0.14 : 0.42, fillRate) * dt);
          npc.investigatePos.copy(this.playerPos);
          npc.investigateArrived = false;

          if (npc.suspicion >= 1 && npc.state !== 'alert' && npc.state !== 'hunt') {
            const escalateToHunt = npc.archetype === 'bodyguard' || this.globalSuspicion >= 50;
            npc.state = escalateToHunt ? 'hunt' : 'alert';
            npc.stateTimer = escalateToHunt ? 11.0 : 8.5;
            this.audio.playSuspicionCue('alert');
            this.addGlobalSuspicion(12);
            npc.targetBell = npc.archetype === 'guard' ? this.findNearestActiveBell(npc.position, 15) : null;
            this.showBanner(
              escalateToHunt
                ? `${npc.name} iniciou Caça Total!`
                : `${npc.name} avistou você!`,
              2.2,
            );
          } else if (npc.suspicion >= 1 && npc.state === 'alert') {
            npc.stateTimer = Math.max(npc.stateTimer, 6.0);
            if (npc.stateTimer < 7.0) {
              npc.state = 'hunt';
              npc.stateTimer = 10.5;
            }
          } else if (npc.suspicion >= 0.55 && (npc.state === 'patrol' || npc.state === 'resting' || npc.state === 'curious')) {
            npc.state = 'suspicious';
            npc.stateTimer = 5.6;
            npc.investigateArrived = false;
            this.audio.playSuspicionCue('suspicious');
          } else if (npc.suspicion >= 0.18 && (npc.state === 'patrol' || npc.state === 'resting')) {
            npc.state = 'curious';
            npc.stateTimer = 4.8;
            npc.investigateArrived = false;
            this.audio.playSuspicionCue('curious');
          }
        } else if (hearsPlayer && (npc.state === 'patrol' || npc.state === 'resting')) {
          npc.restTimer = 0;
          npc.suspicion = Math.max(npc.suspicion, 0.36);
          npc.state = 'curious';
          npc.stateTimer = 5.4;
          npc.investigateArrived = false;
          npc.investigatePos.copy(this.playerPos);
          this.audio.playSuspicionCue('curious');
        } else {
          npc.suspicion = Math.max(0, npc.suspicion - dt * 0.22);
          if (npc.state === 'resting') {
            npc.restTimer -= dt;
            if (npc.restTimer <= 0) {
              npc.state = 'patrol';
              npc.restCooldown = 14 + Math.random() * 8;
              npc.waypointIndex = (npc.waypointIndex + 1) % npc.route.length;
            }
          } else if (npc.state === 'hunt' || npc.state === 'alert' || npc.state === 'suspicious' || npc.state === 'curious') {
            npc.stateTimer -= dt;
            if (npc.stateTimer <= 0) {
              if (npc.state === 'hunt') {
                npc.state = 'suspicious';
                npc.stateTimer = 4.5;
                npc.suspicion = 0.6;
              } else {
                npc.state = 'patrol';
                npc.investigateArrived = false;
                npc.attackWindup = 0;
                npc.targetBell = null;
                npc.waypointIndex = this.pickBestWaypoint(npc);
              }
            }
          }
        }
      } else if (npc.archetype === 'cultist') {
        // Cultists chant occult alerts and raise Infamy rather than fleeing blindly
        if (witnessesFeeding || (seesPlayer && this.exposure > 72)) {
          npc.restTimer = 0;
          if (npc.state !== 'alert') {
            npc.state = 'alert';
            npc.suspicion = 1;
            npc.stateTimer = 6.5;
            npc.investigatePos.copy(this.playerPos);
            this.audio.playWhisperBurst(0.85, 1);
            this.addGlobalSuspicion(8);
            this.addDistrictInfamy(npc.position, 6);
            this.showBanner(`${npc.name} entoou um cântico de alerta! (+Infâmia)`, 2.5);
            for (const other of this.npcs) {
              if (
                (other.archetype === 'guard' || other.archetype === 'bodyguard' || other.archetype === 'hunter') &&
                other.state !== 'drained' &&
                other.state !== 'stunned' &&
                other.state !== 'possessed' &&
                other.position.distanceTo(npc.position) < 18.0
              ) {
                other.restTimer = 0;
                other.state = 'suspicious';
                other.suspicion = Math.max(other.suspicion, 0.78);
                other.stateTimer = 7.0;
                other.investigatePos.copy(this.playerPos);
              }
            }
          }
        } else if (npc.state === 'resting') {
          npc.restTimer -= dt;
          if (npc.restTimer <= 0) {
            npc.state = 'patrol';
            npc.restCooldown = 12 + Math.random() * 8;
          }
        } else if (npc.state === 'alert' || npc.state === 'curious' || npc.state === 'suspicious') {
          npc.stateTimer -= dt;
          if (npc.stateTimer <= 0) {
            npc.state = 'patrol';
            npc.suspicion = 0;
            npc.waypointIndex = this.pickBestWaypoint(npc);
          }
        }
      } else {
        // Citizens, Nobles, Beggars
        if (witnessesFeeding || (seesPlayer && this.exposure > 72)) {
          npc.restTimer = 0;
          if (npc.state !== 'flee') {
            npc.state = 'flee';
            npc.stateTimer = 7.5;
            if (witnessesFeeding) {
              this.addGlobalSuspicion(npc.archetype === 'beggar' ? 6 : 15);
              if (npc.archetype !== 'beggar') {
                npc.targetBell = this.findNearestActiveBell(npc.position, 26);
                this.showBanner(`${npc.name} correu para o sino!`, 2.2);
              }
              for (const other of this.npcs) {
                if (
                  (other.archetype === 'guard' || other.archetype === 'bodyguard' || other.archetype === 'hunter') &&
                  other.state !== 'drained' &&
                  other.state !== 'stunned' &&
                  other.state !== 'possessed' &&
                  other.position.distanceTo(npc.position) < 16.5
                ) {
                  other.restTimer = 0;
                  other.state = 'suspicious';
                  other.suspicion = Math.max(other.suspicion, 0.72);
                  other.stateTimer = 6.5;
                  other.investigatePos.copy(this.playerPos);
                }
              }
            }
          }
        } else if (npc.state === 'resting') {
          npc.restTimer -= dt;
          if (npc.restTimer <= 0) {
            npc.state = 'patrol';
            npc.restCooldown = 14 + Math.random() * 10;
          }
        } else if (npc.state === 'flee' || npc.state === 'curious' || npc.state === 'suspicious') {
          npc.stateTimer -= dt;
          if (npc.stateTimer <= 0) {
            npc.state = 'patrol';
            npc.suspicion = 0;
            npc.targetBell = null;
            npc.waypointIndex = this.pickBestWaypoint(npc);
          }
        }
      }

      // Alarm Bell Ringing Check!
      if (npc.targetBell && !npc.targetBell.sabotaged && npc.targetBell.cooldown <= 0) {
        if (npc.position.distanceTo(npc.targetBell.position) <= 2.4) {
          this.triggerAlarmBell(npc.targetBell);
          npc.targetBell = null;
        }
      } else {
        npc.targetBell = null;
      }

      // Movement & Attack logic
      let moveTarget: THREE.Vector3 | null = null;
      const rainCitizenMult =
        this.weather === 'rain' && (npc.archetype === 'citizen' || npc.archetype === 'noble') ? 1.22 : 1.0;
      let moveSpeed = npc.speed * (isGuardRole ? susSpeedMult : rainCitizenMult);

      if (playerSafeCemetery && !npcInSafeCemetery && (npc.state === 'alert' || npc.state === 'hunt' || npc.state === 'suspicious')) {
        npc.suspicion = Math.max(0, npc.suspicion - dt * 1.2);
        npc.stateTimer = Math.max(0, npc.stateTimer - dt * 2.0);
        if (npc.state === 'alert' || npc.state === 'hunt') {
          npc.state = 'suspicious';
          npc.attackWindup = 0;
          npc.targetBell = null;
        }
      }
      if (npcInSafeCemetery) {
        npc.state = 'patrol';
        npc.suspicion = 0;
        npc.attackWindup = 0;
        npc.targetBell = null;
        moveTarget = npc.route[npc.waypointIndex];
        moveSpeed *= 1.25;
      } else if (npc.targetBell && (npc.state === 'flee' || ((npc.state === 'alert' || npc.state === 'hunt') && horizDist > 6.5))) {
        moveTarget = npc.targetBell.position;
        moveSpeed *= 1.5;
      } else if (npc.state === 'resting') {
        moveTarget = null;
        if (npc.archetype === 'cultist') {
          if (Math.random() < 0.08) {
            const sparkHex = npc.name === 'Boticário' ? 0x34d399 : 0xb366ff;
            this.emitParticles(npc.position.clone().setY(npc.position.y + 1.15), 1, sparkHex, 0.9, 0.45, 0.4, 0.65);
          }
        } else if (npc.archetype === 'noble') {
          npc.yaw += Math.sin(this.sharedUniforms.uTime.value * 0.9 + npc.id) * dt * 0.38;
        } else if (isGuardRole) {
          const scanAmp = this.weather === 'fog' ? 1.25 : 0.75;
          npc.yaw += Math.sin(this.sharedUniforms.uTime.value * 1.4 + npc.id) * dt * scanAmp;
        }
      } else if (npc.state === 'patrol') {
        if (npc.archetype === 'bodyguard' && npc.escortTarget && npc.escortTarget.state !== 'drained') {
          const esc = npc.escortTarget;
          const sinE = Math.sin(esc.yaw);
          const cosE = Math.cos(esc.yaw);
          _v4.set(esc.position.x - cosE * 1.35 - sinE * 1.35, esc.position.y, esc.position.z + sinE * 1.35 - cosE * 1.35);
          if (npc.position.distanceTo(_v4) > 0.9) {
            moveTarget = _v4;
            moveSpeed = Math.max(moveSpeed, esc.speed * 1.12);
          } else {
            npc.yaw = esc.yaw;
            moveTarget = null;
          }
        } else {
          moveTarget = npc.route[npc.waypointIndex];
          if (Math.hypot(npc.position.x - moveTarget.x, npc.position.z - moveTarget.z) < 1.05) {
            // Check for lamp rest (guards), ritual chant (cultists), alley huddle (beggars) or courtly pause (nobles)
            if (npc.restCooldown <= 0) {
              if (npc.archetype === 'guard') {
                const nearLamp = this.world.lamps.find(
                  (l) =>
                    l.isLit &&
                    Math.abs(l.position.y - npc.position.y) < 1.5 &&
                    Math.hypot(l.position.x - npc.position.x, l.position.z - npc.position.z) < 6.5,
                );
                if (nearLamp) {
                  npc.state = 'resting';
                  npc.restTimer =
                    (this.weather === 'fog' ? 5.2 : this.weather === 'rain' ? 2.6 : 4.2) + Math.random() * 1.4;
                  moveTarget = null;
                }
              } else if (npc.archetype === 'beggar' || npc.archetype === 'cultist' || npc.archetype === 'noble') {
                npc.state = 'resting';
                npc.restTimer = (npc.archetype === 'noble' ? 2.6 : 3.2) + Math.random() * 1.6;
                moveTarget = null;
              }
            }
            if (npc.state === 'patrol') {
              npc.waypointIndex = (npc.waypointIndex + 1) % npc.route.length;
              moveTarget = npc.route[npc.waypointIndex];
            }
          }
        }
      } else if (npc.state === 'curious' || npc.state === 'suspicious') {
        if (playerSafeCemetery && this.isInSafeCemetery(npc.investigatePos)) {
          moveTarget = npc.route[npc.waypointIndex];
        } else {
          const distToInvestigate = Math.hypot(
            npc.investigatePos.x - npc.position.x,
            npc.investigatePos.z - npc.position.z,
          );
          if (distToInvestigate > 1.45 && !npc.investigateArrived) {
            moveTarget = npc.investigatePos;
            moveSpeed *= npc.state === 'curious' ? 0.92 : isGuardRole ? 1.12 : 0.96;
          } else {
            if (!npc.investigateArrived) {
              npc.investigateArrived = true;
              npc.stateTimer = Math.max(npc.stateTimer, 3.0);
            }
            npc.yaw += Math.sin(this.sharedUniforms.uTime.value * 2.4 + npc.id) * dt * 1.5;
            moveTarget = null;
          }
        }
      } else if (npc.state === 'alert' || npc.state === 'hunt') {
        if (!isGuardRole) {
          // Cultist stands & chants facing player
          _v1.subVectors(this.playerPos, npc.position);
          npc.yaw = Math.atan2(_v1.x, _v1.z);
          moveTarget = null;
        } else {
          // Coordinate nearby guards within 14m during active hunt
          if (npc.state === 'hunt') {
            for (const other of this.npcs) {
              if (
                other !== npc &&
                (other.archetype === 'guard' || other.archetype === 'bodyguard' || other.archetype === 'hunter') &&
                other.state !== 'drained' &&
                other.state !== 'stunned' &&
                other.state !== 'possessed' &&
                other.state !== 'hunt' &&
                other.position.distanceTo(npc.position) < 14.0
              ) {
                other.restTimer = 0;
                other.state = 'alert';
                other.suspicion = 1;
                other.stateTimer = 8.0;
                other.investigatePos.copy(this.playerPos);
              }
            }
          }

          if (
            npc.archetype === 'hunter' &&
            !playerHidden &&
            horizDist >= 3.2 &&
            horizDist <= 14.8 &&
            hasLineOfSight(npc.position, this.playerPos, this.world.volumes)
          ) {
            _v1.subVectors(this.playerPos, npc.position);
            npc.yaw = Math.atan2(_v1.x, _v1.z);
            moveTarget = npc.position;
            moveSpeed *= 0.25;
            npc.attackWindup = 0;
            if (npc.boltCooldown <= 0) {
              const origin = npc.position.clone().setY(npc.position.y + 1.38);
              const aimDir = this.playerPos.clone().setY(this.playerPos.y + 1.18).sub(origin).normalize();
              this.spawnProjectile(true, origin, aimDir.multiplyScalar(22), 1.0);
              npc.boltCooldown = npc.state === 'hunt' ? 1.75 : 2.35;
              this.audio.playShadowThrow();
            }
          } else if (horizDist > 2.3 || vertDiff > 1.8) {
            moveTarget = playerHidden ? npc.investigatePos : this.playerPos;
            moveSpeed *= npc.state === 'hunt' ? 1.58 : 1.45;
            npc.attackWindup = 0;
          } else if (!playerHidden) {
            _v1.subVectors(this.playerPos, npc.position);
            npc.yaw = Math.atan2(_v1.x, _v1.z);
            if (npc.attackCooldown <= 0) {
              npc.attackWindup += dt;
              if (npc.attackWindup >= 0.52) {
                npc.attackWindup = 0;
                npc.attackSwingTimer = 0.24;
                npc.attackCooldown = Math.max(
                  0.8,
                  (npc.state === 'hunt' ? 1.15 : 1.35) - (this.globalSuspicion / 100) * 0.35,
                );
                if (horizDist < 2.9 && vertDiff < 2.0 && this.dashTimer <= 0 && this.mistFormTimer <= 0) {
                  const dmg =
                    (npc.archetype === 'hunter' ? 23 : npc.archetype === 'bodyguard' ? 21 : 16) +
                    (this.nightNumber - 1) * 4;
                  this.health -= dmg;
                  this.hitstopTimer = 0.055;
                  this.shakeIntensity = 0.38;
                  this.audio.playPlayerHit();
                  this.emitParticles(
                    this.playerPos.clone().setY(this.playerPos.y + 1.2),
                    14,
                    0xfbbf24,
                    5.0,
                    0.45,
                    -4,
                    1.0,
                  );
                  if (this.health <= 0) {
                    this.triggerGameOver(
                      npc.archetype === 'hunter'
                        ? 'Abatido pelo Caçador de Vampiros da Ordem Escarlate.'
                        : npc.archetype === 'bodyguard'
                        ? 'Abatido pelo Guarda-Costas Juramentado.'
                        : 'Abatido pela lâmina de prata da Vigília.',
                    );
                    return;
                  }
                }
              }
            }
          }
        }
      } else if (npc.state === 'flee') {
        _v3.set(npc.position.x - this.playerPos.x, 0, npc.position.z - this.playerPos.z).normalize();
        _v4.copy(npc.position).addScaledVector(_v3, 6.0);
        moveTarget = _v4;
        moveSpeed *= 1.65;
      }

      const distToTarget = moveTarget
        ? Math.hypot(moveTarget.x - npc.position.x, moveTarget.z - npc.position.z)
        : 0;
      if (moveTarget && distToTarget > 0.35) {
        const desX = (moveTarget.x - npc.position.x) / distToTarget;
        const desZ = (moveTarget.z - npc.position.z) / distToTarget;

        // Forward obstacle-avoidance steering using directional probes against height-relevant volumes
        const lookAhead = Math.min(distToTarget + 0.4, Math.max(1.85, moveSpeed * 0.92));
        const footY = npc.position.y + 0.65;
        const headY = npc.position.y + 1.75;
        const probePad = 0.34;
        const cHit = probeObstacleClearance(
          npc.position.x,
          npc.position.z,
          desX,
          desZ,
          lookAhead,
          footY,
          headY,
          probePad,
          this.world.volumes,
        );

        let targetSteerOffset = 0;
        if (cHit < lookAhead - 0.08) {
          const sin32 = 0.5299;
          const cos32 = 0.848;
          const l1 = probeObstacleClearance(
            npc.position.x,
            npc.position.z,
            desX * cos32 + desZ * sin32,
            -desX * sin32 + desZ * cos32,
            lookAhead,
            footY,
            headY,
            probePad,
            this.world.volumes,
          );
          const r1 = probeObstacleClearance(
            npc.position.x,
            npc.position.z,
            desX * cos32 - desZ * sin32,
            desX * sin32 + desZ * cos32,
            lookAhead,
            footY,
            headY,
            probePad,
            this.world.volumes,
          );

          const sin64 = 0.8988;
          const cos64 = 0.4384;
          const l2 = probeObstacleClearance(
            npc.position.x,
            npc.position.z,
            desX * cos64 + desZ * sin64,
            -desX * sin64 + desZ * cos64,
            lookAhead,
            footY,
            headY,
            probePad,
            this.world.volumes,
          );
          const r2 = probeObstacleClearance(
            npc.position.x,
            npc.position.z,
            desX * cos64 - desZ * sin64,
            desX * sin64 + desZ * cos64,
            lookAhead,
            footY,
            headY,
            probePad,
            this.world.volumes,
          );

          const leftScore = l1 + l2 * 0.75 + (npc.avoidSign > 0 ? 0.35 : 0);
          const rightScore = r1 + r2 * 0.75 + (npc.avoidSign < 0 ? 0.35 : 0);
          const sign = leftScore >= rightScore ? 1 : -1;
          const bestInner = sign > 0 ? l1 : r1;
          const urgency = 0.48 + 0.52 * (1 - cHit / lookAhead);
          const baseTurn = bestInner >= lookAhead * 0.84 ? 0.62 : 1.16;
          targetSteerOffset = sign * baseTurn * urgency;
        }

        npc.steerAngleOffset = THREE.MathUtils.damp(npc.steerAngleOffset, targetSteerOffset, 9, dt);
        const cs = Math.cos(npc.steerAngleOffset);
        const sn = Math.sin(npc.steerAngleOffset);
        const moveDirX = desX * cs + desZ * sn;
        const moveDirZ = -desX * sn + desZ * cs;

        // 1.3s Stuck Detector: apply lateral unstick nudge & advance/recalculate destination if stalled
        npc.stuckTimer += dt;
        if (npc.stuckTimer >= 1.3) {
          const movedDist = Math.hypot(
            npc.position.x - npc.lastStuckCheckPos.x,
            npc.position.z - npc.lastStuckCheckPos.z,
          );
          if (movedDist < 0.55) {
            npc.avoidSign *= -1;
            const sideX = -desZ * npc.avoidSign;
            const sideZ = desX * npc.avoidSign;
            npc.position.x += sideX * 0.42;
            npc.position.z += sideZ * 0.42;
            npc.steerAngleOffset = npc.avoidSign * 1.1;
            if (npc.state === 'patrol' && npc.archetype !== 'bodyguard') {
              npc.waypointIndex = this.pickBestWaypoint(npc, npc.waypointIndex);
            } else if (npc.state === 'flee') {
              npc.targetBell = null;
            } else if (npc.state === 'suspicious' || npc.state === 'curious') {
              npc.investigateArrived = true;
              npc.stateTimer = Math.min(npc.stateTimer, 1.4);
            } else if ((npc.state === 'alert' || npc.state === 'hunt') && playerHidden) {
              npc.stateTimer = Math.min(npc.stateTimer, 2.0);
            }
          }
          npc.lastStuckCheckPos.copy(npc.position);
          npc.stuckTimer = 0;
        }

        _v1.set(moveDirX, 0, moveDirZ);
        npc.position.addScaledVector(_v1, moveSpeed * dt);
        npc.frameMoveDirX = moveDirX;
        npc.frameMoveDirZ = moveDirZ;
        npc.frameMoveSpeed = moveSpeed;
        npc.frameIsMoving = true;

        const targetYaw = Math.atan2(moveDirX, moveDirZ);
        let diff = targetYaw - npc.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        npc.yaw += diff * Math.min(1, dt * 8);
        npc.walkPhase += dt * moveSpeed * 2.8;
      } else {
        npc.steerAngleOffset = THREE.MathUtils.damp(npc.steerAngleOffset, 0, 10, dt);
        npc.stuckTimer = 0;
        npc.lastStuckCheckPos.copy(npc.position);
      }
    }

    // Pass 2: Pairwise NPC-to-NPC physical collision & smooth separation (~0.5m radius each)
    // Executed BEFORE wall/volume checks so separation never pushes any NPC inside walls or fences.
    const npcMinSep = 1.0;
    const npcMinSepSq = npcMinSep * npcMinSep;
    const sepStrength = Math.min(0.85, 0.35 + dt * 16);
    for (let i = 0; i < this.npcs.length; i++) {
      const a = this.npcs[i];
      if (a.state === 'drained') continue;
      for (let j = i + 1; j < this.npcs.length; j++) {
        const b = this.npcs[j];
        if (b.state === 'drained') continue;
        if (Math.abs(a.position.y - b.position.y) >= 1.8) continue;

        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < npcMinSepSq) {
          const dist = Math.sqrt(distSq);
          const overlap = npcMinSep - dist;
          let nx: number;
          let nz: number;
          if (dist > 0.0001) {
            nx = dx / dist;
            nz = dz / dist;
          } else {
            const fallbackAngle = a.id * 1.73 + b.id * 2.41;
            nx = Math.cos(fallbackAngle);
            nz = Math.sin(fallbackAngle);
          }

          const push = Math.min(0.42, overlap * sepStrength);
          const pinA = isFeeding && a === this.feedTarget;
          const pinB = isFeeding && b === this.feedTarget;
          if (pinA && pinB) continue;
          const wA = pinA ? 0 : pinB ? 1 : 0.5;
          const wB = pinB ? 0 : pinA ? 1 : 0.5;

          a.position.x -= nx * push * wA;
          a.position.z -= nz * push * wA;
          b.position.x += nx * push * wB;
          b.position.z += nz * push * wB;
        }
      }
    }

    // Pass 3: Wall/Volume collision resolution, ground elevation, and procedural combat/locomotion animation
    const uTime = this.sharedUniforms.uTime.value;
    for (const npc of this.npcs) {
      if (npc.state === 'drained') continue;

      if (!(isFeeding && npc === this.feedTarget)) {
        const hitWall = resolveHorizontal3D(npc.position, 0.45, this.world.volumes, this.world.playableBounds);
        if (hitWall && npc.frameIsMoving && npc.frameMoveSpeed > 0) {
          const sideX = -npc.frameMoveDirZ * npc.avoidSign;
          const sideZ = npc.frameMoveDirX * npc.avoidSign;
          npc.position.x += sideX * npc.frameMoveSpeed * dt * 0.95;
          npc.position.z += sideZ * npc.frameMoveSpeed * dt * 0.95;
          resolveHorizontal3D(npc.position, 0.45, this.world.volumes, this.world.playableBounds);
        }

        const npcFloor = getFloorHeightAt(
          npc.position.x,
          npc.position.z,
          npc.position.y,
          0.35,
          this.world.volumes,
          this.world.cryptBounds,
        );
        npc.position.y = THREE.MathUtils.damp(npc.position.y, npcFloor, 12, dt);
      }

      npc.rig.root.position.copy(npc.position);
      npc.rig.root.rotation.y = npc.yaw;

      if (isFeeding && npc === this.feedTarget) {
        this.updateNpcAlertIndicator(npc);
        continue;
      }

      const isGuardRole =
        npc.archetype === 'guard' || npc.archetype === 'bodyguard' || npc.archetype === 'hunter';

      if (npc.hitStaggerTimer > 0) {
        // Impulse-and-recovery hit recoil curve
        const t = 1 - npc.hitStaggerTimer / Math.max(0.05, npc.hitStaggerDuration);
        const recoil = Math.pow(1 - t, 1.55) * Math.sin(Math.min(1, t * 5.0) * Math.PI * 0.5);
        npc.rig.bodyGroup.rotation.x = -0.46 * recoil;
        npc.rig.bodyGroup.rotation.z = npc.hitRecoilDir * 0.24 * recoil;
        npc.rig.bodyGroup.position.y = -0.07 * recoil;
        npc.rig.leftArm.rotation.x = THREE.MathUtils.damp(
          npc.rig.leftArm.rotation.x,
          -0.78 * recoil - 0.15,
          16,
          dt,
        );
        npc.rig.rightArm.rotation.x = THREE.MathUtils.damp(
          npc.rig.rightArm.rotation.x,
          -0.68 * recoil - 0.15,
          16,
          dt,
        );
        npc.rig.leftArm.rotation.z = THREE.MathUtils.damp(npc.rig.leftArm.rotation.z, -0.44 * recoil, 16, dt);
        npc.rig.rightArm.rotation.z = THREE.MathUtils.damp(npc.rig.rightArm.rotation.z, 0.44 * recoil, 16, dt);
      } else if (npc.state === 'stunned') {
        npc.rig.bodyGroup.rotation.x = THREE.MathUtils.damp(npc.rig.bodyGroup.rotation.x, 0.12, 10, dt);
        npc.rig.bodyGroup.rotation.z = Math.sin(uTime * 18) * 0.1;
        npc.rig.bodyGroup.position.y = THREE.MathUtils.damp(npc.rig.bodyGroup.position.y, -0.04, 10, dt);
        npc.rig.leftArm.rotation.x = THREE.MathUtils.damp(npc.rig.leftArm.rotation.x, 0.24, 10, dt);
        npc.rig.rightArm.rotation.x = THREE.MathUtils.damp(npc.rig.rightArm.rotation.x, 0.24, 10, dt);
      } else if (npc.state === 'possessed') {
        npc.rig.bodyGroup.rotation.x = THREE.MathUtils.damp(npc.rig.bodyGroup.rotation.x, 0.08, 10, dt);
        npc.rig.bodyGroup.rotation.z = THREE.MathUtils.damp(npc.rig.bodyGroup.rotation.z, 0, 10, dt);
        npc.rig.bodyGroup.position.y = THREE.MathUtils.damp(npc.rig.bodyGroup.position.y, 0, 10, dt);
        const pSwing = npc.frameIsMoving ? Math.sin(npc.walkPhase) * 0.45 : 0;
        npc.rig.leftLeg.rotation.x = THREE.MathUtils.damp(npc.rig.leftLeg.rotation.x, pSwing, 10, dt);
        npc.rig.rightLeg.rotation.x = THREE.MathUtils.damp(npc.rig.rightLeg.rotation.x, -pSwing, 10, dt);
        npc.rig.leftArm.rotation.x = THREE.MathUtils.damp(npc.rig.leftArm.rotation.x, -0.75, 8, dt);
        npc.rig.rightArm.rotation.x = THREE.MathUtils.damp(npc.rig.rightArm.rotation.x, -0.75, 8, dt);
        npc.rig.leftArm.rotation.z = THREE.MathUtils.damp(npc.rig.leftArm.rotation.z, 0, 8, dt);
        npc.rig.rightArm.rotation.z = THREE.MathUtils.damp(npc.rig.rightArm.rotation.z, 0, 8, dt);
      } else {
        const isCombatStance = isGuardRole && (npc.state === 'alert' || npc.state === 'hunt');
        const legSwing = npc.frameIsMoving
          ? Math.sin(npc.walkPhase) * 0.45
          : isCombatStance
          ? 0.16
          : 0;
        npc.rig.leftLeg.rotation.x = THREE.MathUtils.damp(npc.rig.leftLeg.rotation.x, legSwing, 10, dt);
        npc.rig.rightLeg.rotation.x = THREE.MathUtils.damp(
          npc.rig.rightLeg.rotation.x,
          isCombatStance && !npc.frameIsMoving ? -0.16 : -legSwing,
          10,
          dt,
        );

        const targetBodyX = isCombatStance
          ? 0.14 +
            (npc.attackWindup > 0
              ? -0.18 * Math.min(1, npc.attackWindup / 0.52)
              : npc.attackSwingTimer > 0
              ? 0.24 * Math.sin((npc.attackSwingTimer / 0.24) * Math.PI)
              : 0)
          : npc.state === 'resting' && npc.archetype === 'beggar'
          ? 0.28
          : 0;
        const targetBodyY = isCombatStance
          ? -0.06
          : npc.state === 'resting' && npc.archetype === 'beggar'
          ? -0.22
          : 0;
        const targetBodyZ =
          npc.attackSwingTimer > 0
            ? -0.14 * Math.sin((npc.attackSwingTimer / 0.24) * Math.PI)
            : isCombatStance
            ? Math.sin(uTime * 5.5 + npc.id) * 0.03
            : 0;

        npc.rig.bodyGroup.rotation.x = THREE.MathUtils.damp(npc.rig.bodyGroup.rotation.x, targetBodyX, 12, dt);
        npc.rig.bodyGroup.rotation.z = THREE.MathUtils.damp(npc.rig.bodyGroup.rotation.z, targetBodyZ, 12, dt);
        npc.rig.bodyGroup.position.y = THREE.MathUtils.damp(npc.rig.bodyGroup.position.y, targetBodyY, 12, dt);

        if (npc.archetype === 'cultist' && (npc.state === 'resting' || npc.state === 'alert')) {
          const chantAngle = npc.state === 'alert' ? -2.1 : -1.85;
          npc.rig.leftArm.rotation.x = THREE.MathUtils.damp(npc.rig.leftArm.rotation.x, chantAngle, 10, dt);
          npc.rig.rightArm.rotation.x = THREE.MathUtils.damp(npc.rig.rightArm.rotation.x, chantAngle, 10, dt);
          npc.rig.leftArm.rotation.z = THREE.MathUtils.damp(npc.rig.leftArm.rotation.z, -0.15, 10, dt);
          npc.rig.rightArm.rotation.z = THREE.MathUtils.damp(npc.rig.rightArm.rotation.z, 0.15, 10, dt);
        } else if (npc.archetype === 'beggar' && npc.state === 'resting') {
          npc.rig.leftArm.rotation.x = THREE.MathUtils.damp(npc.rig.leftArm.rotation.x, -0.55, 10, dt);
          npc.rig.rightArm.rotation.x = THREE.MathUtils.damp(npc.rig.rightArm.rotation.x, -0.55, 10, dt);
          npc.rig.leftArm.rotation.z = THREE.MathUtils.damp(npc.rig.leftArm.rotation.z, 0, 10, dt);
          npc.rig.rightArm.rotation.z = THREE.MathUtils.damp(npc.rig.rightArm.rotation.z, 0, 10, dt);
        } else if (isCombatStance) {
          if (npc.attackWindup > 0) {
            const wProg = Math.min(1, npc.attackWindup / 0.52);
            npc.rig.rightArm.rotation.x = THREE.MathUtils.damp(npc.rig.rightArm.rotation.x, -1.65 * wProg, 16, dt);
            npc.rig.rightArm.rotation.z = THREE.MathUtils.damp(npc.rig.rightArm.rotation.z, -0.18, 12, dt);
            npc.rig.leftArm.rotation.x = THREE.MathUtils.damp(npc.rig.leftArm.rotation.x, -1.02, 12, dt);
            npc.rig.leftArm.rotation.z = THREE.MathUtils.damp(npc.rig.leftArm.rotation.z, 0.16, 12, dt);
          } else if (npc.attackSwingTimer > 0) {
            const sProg = 1 - npc.attackSwingTimer / 0.24;
            npc.rig.rightArm.rotation.x = THREE.MathUtils.damp(
              npc.rig.rightArm.rotation.x,
              -1.35 + sProg * 2.05,
              22,
              dt,
            );
            npc.rig.rightArm.rotation.z = THREE.MathUtils.damp(npc.rig.rightArm.rotation.z, 0.15, 18, dt);
            npc.rig.leftArm.rotation.x = THREE.MathUtils.damp(npc.rig.leftArm.rotation.x, -0.68, 12, dt);
            npc.rig.leftArm.rotation.z = THREE.MathUtils.damp(npc.rig.leftArm.rotation.z, 0.14, 12, dt);
          } else {
            // Armed combat guard posture (leveled crossbow for hunters, braced halberd/mace for guards)
            const guardRightX =
              npc.archetype === 'hunter' ? -1.32 : -0.92 + Math.sin(npc.walkPhase) * 0.14;
            npc.rig.rightArm.rotation.x = THREE.MathUtils.damp(npc.rig.rightArm.rotation.x, guardRightX, 11, dt);
            npc.rig.rightArm.rotation.z = THREE.MathUtils.damp(npc.rig.rightArm.rotation.z, -0.2, 10, dt);
            npc.rig.leftArm.rotation.x = THREE.MathUtils.damp(npc.rig.leftArm.rotation.x, -0.88, 10, dt);
            npc.rig.leftArm.rotation.z = THREE.MathUtils.damp(npc.rig.leftArm.rotation.z, 0.16, 10, dt);
          }
          if (npc.rig.lanternMat) {
            npc.rig.lanternMat.color.setHex(0xffe08a);
          }
        } else {
          const isInvestigatingWithLantern =
            isGuardRole && (npc.state === 'curious' || npc.state === 'suspicious');
          const targetLeftArm = isInvestigatingWithLantern
            ? -1.05
            : npc.archetype === 'cultist'
            ? -0.78
            : legSwing * 0.4;
          npc.rig.leftArm.rotation.x = THREE.MathUtils.damp(npc.rig.leftArm.rotation.x, targetLeftArm, 8, dt);
          npc.rig.rightArm.rotation.x = THREE.MathUtils.damp(npc.rig.rightArm.rotation.x, -legSwing * 0.4, 8, dt);
          npc.rig.leftArm.rotation.z = THREE.MathUtils.damp(npc.rig.leftArm.rotation.z, 0, 8, dt);
          npc.rig.rightArm.rotation.z = THREE.MathUtils.damp(npc.rig.rightArm.rotation.z, 0, 8, dt);
          if (npc.rig.lanternMat && npc.archetype !== 'cultist') {
            npc.rig.lanternMat.color.setHex(isInvestigatingWithLantern ? 0xffe08a : 0xffaa44);
          }
        }
      }

      if (npc.rig.visionCone && npc.rig.visionConeMat && npc.rig.visionCone.visible) {
        const horizDist = Math.hypot(this.playerPos.x - npc.position.x, this.playerPos.z - npc.position.z);
        const proxAlpha = horizDist <= 14.5 ? THREE.MathUtils.clamp((14.5 - horizDist) / 4.0, 0, 1) : 0;
        const stealthAlpha =
          isPlayerStealth && horizDist <= 24.0
            ? THREE.MathUtils.clamp((24.0 - horizDist) / 5.0, 0, 1) * 0.85
            : 0;
        const senseAlpha = senseVal > 0.08 && horizDist <= auspRange ? senseVal : 0;
        const visFactor = Math.max(senseAlpha, proxAlpha, stealthAlpha);

        if (visFactor <= 0.01) {
          npc.rig.visionCone.visible = false;
        } else if (npc.state === 'hunt' || npc.state === 'alert' || npc.state === 'flee') {
          npc.rig.visionConeMat.color.setHex(0xef4444);
          npc.rig.visionConeMat.opacity = (senseAlpha > 0 ? 0.38 : 0.24) * visFactor;
        } else if (npc.state === 'suspicious' || npc.state === 'curious') {
          npc.rig.visionConeMat.color.setHex(0xfacc15);
          npc.rig.visionConeMat.opacity = (senseAlpha > 0 ? 0.3 : 0.19) * visFactor;
        } else {
          npc.rig.visionConeMat.color.setHex(0x60a5fa);
          npc.rig.visionConeMat.opacity = (senseAlpha > 0 ? 0.22 : 0.14) * visFactor;
        }
      }

      this.updateNpcAlertIndicator(npc);
    }
  }

  private pickBestWaypoint(npc: NpcEntity, excludeIdx = -1): number {
    let bestIdx = (npc.waypointIndex + 1) % npc.route.length;
    let bestScore = Infinity;
    for (let i = 0; i < npc.route.length; i++) {
      if (i === excludeIdx && npc.route.length > 1) continue;
      const wp = npc.route[i];
      const dist = Math.hypot(wp.x - npc.position.x, wp.z - npc.position.z);
      const visible = hasLineOfSight(npc.position, wp, this.world.volumes);
      const score = visible ? dist : dist + 45;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private updateNpcAlertIndicator(npc: NpcEntity): void {
    const mesh = npc.rig.alertSpriteMesh;
    const mat = npc.rig.alertMat;
    const dist = Math.hypot(npc.position.x - this.playerPos.x, npc.position.z - this.playerPos.z);
    const isGuardRole =
      npc.archetype === 'guard' || npc.archetype === 'bodyguard' || npc.archetype === 'hunter';

    let desiredMap = this.textures.eyeClosedMap;
    let visible = true;

    if (npc.state === 'alert' || npc.state === 'hunt') {
      desiredMap = this.textures.eyeOpenMap;
      mat.color.setHex(npc.attackWindup > 0 ? 0xffffff : npc.state === 'hunt' ? 0xdc2626 : 0xef4444);
      mat.opacity = 1.0;
      const pulse = 1.2 + Math.sin(this.sharedUniforms.uTime.value * 14 + npc.id) * 0.12;
      mesh.scale.setScalar(npc.attackWindup > 0 ? 1.42 : pulse);
    } else if (npc.state === 'flee') {
      desiredMap = this.textures.eyeOpenMap;
      mat.color.setHex(0xf97316);
      mat.opacity = 0.96;
      mesh.scale.setScalar(1.06);
    } else if (npc.state === 'suspicious' || (isGuardRole && npc.suspicion > 0.35)) {
      desiredMap = this.textures.eyeHalfMap;
      mat.color.setHex(0xfacc15);
      mat.opacity = 0.94;
      mesh.scale.setScalar(0.88 + npc.suspicion * 0.28);
    } else if (npc.state === 'curious' || (isGuardRole && npc.suspicion > 0.12)) {
      desiredMap = this.textures.eyeHalfMap;
      mat.color.setHex(0x93c5fd);
      mat.opacity = 0.85;
      mesh.scale.setScalar(0.82);
    } else if (npc.state === 'possessed') {
      desiredMap = this.textures.eyeHalfMap;
      mat.color.setHex(0xa855f7);
      mat.opacity = 0.95;
      mesh.scale.setScalar(0.96);
    } else if (npc.state === 'stunned') {
      desiredMap = this.textures.eyeClosedMap;
      mat.color.setHex(0x818cf8);
      mat.opacity = 0.9;
      mesh.scale.setScalar(0.9);
    } else if (isGuardRole && dist <= 26) {
      desiredMap = this.textures.eyeClosedMap;
      mat.color.setHex(0x94a3b8);
      mat.opacity = npc.state === 'resting' ? 0.34 : 0.48;
      mesh.scale.setScalar(0.78);
    } else if (!isGuardRole && dist <= 13 && this.exposure > 52) {
      desiredMap = this.textures.eyeClosedMap;
      mat.color.setHex(0x94a3b8);
      mat.opacity = 0.36;
      mesh.scale.setScalar(0.72);
    } else {
      visible = false;
    }

    mesh.visible = visible;
    if (visible) {
      if (mat.map !== desiredMap) {
        mat.map = desiredMap;
        mat.needsUpdate = true;
      }
      mesh.lookAt(this.camera.position);
    }
  }

  private updateCamera(dt: number): void {
    const crouchActive =
      this.isCrouching || this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');

    if (this.astralActive) {
      this.fpArms.root.visible = false;
      this.vampire.bodyPivot.visible = this.batFormTimer <= 0;
      this.vampire.contactShadow.visible = true;
      this.camera.rotation.order = 'XYZ';

      const sinY = Math.sin(this.astralYaw);
      const cosY = Math.cos(this.astralYaw);
      const cosP = Math.cos(this.astralPitch);
      const sinP = Math.sin(this.astralPitch);
      const orbitDist = 5.4;

      _camDesired.set(
        this.astralPos.x + sinY * cosP * orbitDist,
        this.astralPos.y + 0.65 + sinP * orbitDist,
        this.astralPos.z + cosY * cosP * orbitDist,
      );
      _camDesired.y = Math.max(1.2, _camDesired.y);

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camDesired.x, 12, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camDesired.y, 12, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camDesired.z, 12, dt);
      _camLook.set(this.astralPos.x, this.astralPos.y + 0.2, this.astralPos.z);
      this.camera.lookAt(_camLook);
      return;
    }

    // Hide full player mesh & show styled first-person hands/claws (except in Bat Form)
    this.vampire.bodyPivot.visible = false;
    this.vampire.contactShadow.visible = false;
    this.fpArms.root.visible = this.batFormTimer <= 0;

    // Smooth vertical transitions across stairs, sidewalk curbs & platforms without hiding jumps
    const floorFollowRate = this.isGrounded ? 17 : 28;
    this.camSmoothFloorY = THREE.MathUtils.damp(this.camSmoothFloorY, this.playerPos.y, floorFollowRate, dt);

    // Smooth crouch & landing eye height interpolation
    const landDip =
      this.jumpLandAnimTimer > 0 ? Math.sin((this.jumpLandAnimTimer / 0.18) * Math.PI) * 0.14 : 0;
    const isFeedingNow = this.feedTimer > 0;
    this.feedCamBlend = THREE.MathUtils.damp(
      this.feedCamBlend,
      isFeedingNow ? 1.0 : 0.0,
      isFeedingNow ? 9.0 : 6.0,
      dt,
    );
    const feedEyeDip =
      this.feedTakedownKind === 'aerial' ? 0.18 * this.feedCamBlend : 0.05 * this.feedCamBlend;
    const targetEye = (crouchActive && !isFeedingNow ? 1.04 : 1.66) - landDip - feedEyeDip;
    this.camEyeHeight = THREE.MathUtils.damp(this.camEyeHeight, targetEye, 12, dt);

    // Subtle footstep head-bob & horizontal strafe lean
    const isMovingOnGround =
      this.isGrounded && this.lastHorizSpeed > 0.45 && !isFeedingNow && this.dashTimer <= 0;
    const speedNorm = isMovingOnGround ? THREE.MathUtils.clamp(this.lastHorizSpeed / 6.4, 0, 1.35) : 0;
    const bobAmp = (crouchActive ? 0.022 : 0.036) * speedNorm;
    const targetBobY = isMovingOnGround ? -Math.cos(this.walkCycle * 2) * bobAmp * 0.65 : 0;
    const targetBobX = isMovingOnGround ? Math.sin(this.walkCycle) * bobAmp * 0.48 : 0;
    this.camBobY = THREE.MathUtils.damp(this.camBobY, targetBobY, 16, dt);
    this.camBobX = THREE.MathUtils.damp(this.camBobX, targetBobX, 16, dt);

    const strafeInput =
      !isFeedingNow && this.phase === 'playing'
        ? (this.heldKeys.has('KeyD') ? 1 : 0) - (this.heldKeys.has('KeyA') ? 1 : 0)
        : 0;
    const targetRoll = -strafeInput * 0.016;
    this.camRoll = THREE.MathUtils.damp(this.camRoll, targetRoll, 11, dt);

    const camRightX = Math.cos(this.camYaw);
    const camRightZ = -Math.sin(this.camYaw);

    _camDesired.set(
      this.playerPos.x + camRightX * this.camBobX,
      this.camSmoothFloorY + this.camEyeHeight + this.camBobY,
      this.playerPos.z + camRightZ * this.camBobX,
    );

    if (this.shakeIntensity > 0.002) {
      _camDesired.x += (Math.random() - 0.5) * this.shakeIntensity;
      _camDesired.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 10, dt);
    }

    this.camera.position.copy(_camDesired);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.camYaw;
    const feedPulse = isFeedingNow
      ? Math.sin(this.sharedUniforms.uTime.value * 16) * 0.012 * this.feedCamBlend
      : 0;
    this.camera.rotation.x = -this.camPitch + feedPulse;
    this.camera.rotation.z = this.camRoll;

    this.updateFirstPersonArms(dt, crouchActive);
  }

  private updateFirstPersonArms(dt: number, crouchActive: boolean): void {
    const isObfActive = this.obfuscateTimer > 0;
    const isMistActive = this.mistFormTimer > 0;
    const isShroudActive = this.abyssalShroudTimer > 0;
    const isVisageActive = this.falseVisageTimer > 0;
    const desiredOpacity = isMistActive
      ? 0.28
      : isObfActive
      ? 0.36
      : this.shadowVeilTimer > 0
      ? 0.45
      : 1.0;

    for (const def of this.fpArms.stealthMatDefaults) {
      if (isMistActive) {
        def.mat.color.lerp(_color.setHex(0xcbd5e1), Math.min(1, dt * 9));
        def.mat.emissive.lerp(_color2.setHex(0x475569), Math.min(1, dt * 9));
        def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0.32, 9, dt);
      } else if (isObfActive) {
        def.mat.color.lerp(_color.setHex(0x38bdf8), Math.min(1, dt * 8));
        def.mat.emissive.lerp(_color2.setHex(0x1d4ed8), Math.min(1, dt * 8));
        def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0.42, 8, dt);
      } else if (isShroudActive) {
        def.mat.color.lerp(_color.setHex(0x111322), Math.min(1, dt * 8));
        def.mat.emissive.lerp(_color2.setHex(0x312e81), Math.min(1, dt * 8));
        def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0.36, 8, dt);
      } else if (isVisageActive) {
        def.mat.color.lerp(_color.setHex(def.baseColor), Math.min(1, dt * 10));
        def.mat.emissive.lerp(_color2.setHex(0x78350f), Math.min(1, dt * 8));
        def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0.22, 8, dt);
      } else {
        def.mat.color.lerp(_color.setHex(def.baseColor), Math.min(1, dt * 10));
        def.mat.emissive.lerp(_color2.setHex(0x000000), Math.min(1, dt * 10));
        def.mat.emissiveIntensity = THREE.MathUtils.damp(def.mat.emissiveIntensity, 0, 10, dt);
      }
      def.mat.opacity = THREE.MathUtils.damp(def.mat.opacity, desiredOpacity, 10, dt);
    }

    const t = this.sharedUniforms.uTime.value;
    const breath = Math.sin(t * 2.1) * 0.005;
    const moveNorm =
      this.isGrounded && this.feedTimer <= 0 && this.dashTimer <= 0
        ? THREE.MathUtils.clamp(this.lastHorizSpeed / 6.4, 0, 1.35)
        : 0;
    const walkX = Math.sin(this.walkCycle) * 0.015 * moveNorm;
    const walkY = -Math.abs(Math.cos(this.walkCycle)) * 0.014 * moveNorm;
    const walkZ = Math.cos(this.walkCycle) * 0.01 * moveNorm;
    const crouchY = crouchActive && this.isGrounded ? -0.022 : 0;
    const crouchZ = crouchActive && this.isGrounded ? -0.024 : 0;

    let targetLX = -0.235 - walkX;
    let targetLY = -0.225 + breath + walkY + crouchY;
    let targetLZ = -0.175 + walkZ + crouchZ;
    let targetLRX = 0.08 + (crouchActive ? 0.08 : 0);
    let targetLRY = 0.22;
    let targetLRZ = -0.14;

    let targetRX = 0.235 - walkX;
    let targetRY = -0.225 - breath + walkY + crouchY;
    let targetRZ = -0.175 - walkZ + crouchZ;
    let targetRRX = 0.08 + (crouchActive ? 0.08 : 0);
    let targetRRY = -0.22;
    let targetRRZ = 0.14;

    if (!this.isGrounded) {
      const airOffset = THREE.MathUtils.clamp(this.playerVelY * 0.004, -0.035, 0.035);
      targetLY -= airOffset;
      targetRY -= airOffset;
      targetLRX += this.playerVelY < 0 ? 0.14 : -0.12;
      targetRRX += this.playerVelY < 0 ? 0.14 : -0.12;
      targetLX -= 0.025;
      targetRX += 0.025;
    } else if (this.dashTimer > 0) {
      targetLZ += 0.04;
      targetRZ += 0.04;
      targetLRX = -0.18;
      targetRRX = -0.18;
    }

    if (this.castAnimTimer > 0) {
      const castRatio = Math.sin(Math.min(1, this.castAnimTimer / 0.26) * Math.PI);
      targetLY += 0.065 * castRatio;
      targetRY += 0.065 * castRatio;
      targetLZ -= 0.075 * castRatio;
      targetRZ -= 0.075 * castRatio;
      targetLRX += 0.36 * castRatio;
      targetRRX += 0.36 * castRatio;
      targetLRY += 0.18 * castRatio;
      targetRRY -= 0.18 * castRatio;
    }

    if (this.feedTimer > 0) {
      const tremble = Math.sin(t * 24) * 0.006;
      targetLX = -0.165 + tremble;
      targetRX = 0.165 - tremble;
      targetLY = -0.175;
      targetRY = -0.175;
      targetLZ = -0.295;
      targetRZ = -0.295;
      targetLRX = 0.28;
      targetRRX = 0.28;
      targetLRY = -0.26;
      targetRRY = 0.26;
      targetLRZ = -0.34;
      targetRRZ = 0.34;
    }

    if (this.clawSlashTimer > 0) {
      const slashProg = 1 - this.clawSlashTimer / Math.max(0.05, this.clawSlashDuration);
      const arc = Math.min(1, slashProg * 1.38);
      const ease = 1 - Math.pow(1 - arc, 3);
      const step = this.clawActiveComboStep;

      if (step === 0) {
        // Right diagonal cross-slash
        targetRX = 0.28 - ease * 0.42;
        targetRY = -0.11 - ease * 0.15;
        targetRZ = -0.14 - Math.sin(ease * Math.PI) * 0.2;
        targetRRX = 0.35 - ease * 0.55;
        targetRRY = -0.35 + ease * 0.95;
        targetRRZ = -0.25 + ease * 0.98;
        targetLX = -0.27;
        targetLZ = -0.13;
      } else if (step === 1) {
        // Left diagonal cross-slash
        targetLX = -0.28 + ease * 0.42;
        targetLY = -0.11 - ease * 0.15;
        targetLZ = -0.14 - Math.sin(ease * Math.PI) * 0.2;
        targetLRX = 0.35 - ease * 0.55;
        targetLRY = 0.35 - ease * 0.95;
        targetLRZ = 0.25 - ease * 0.98;
        targetRX = 0.27;
        targetRZ = -0.13;
      } else {
        // Double-claw forward lunge
        const thrust = Math.sin(ease * Math.PI * 0.85);
        targetLX = -0.25 + ease * 0.13;
        targetRX = 0.25 - ease * 0.13;
        targetLY = -0.15 - ease * 0.06;
        targetRY = -0.15 - ease * 0.06;
        targetLZ = -0.13 - thrust * 0.24;
        targetRZ = -0.13 - thrust * 0.24;
        targetLRX = 0.42 - ease * 0.5;
        targetRRX = 0.42 - ease * 0.5;
        targetLRZ = -0.45 + ease * 0.25;
        targetRRZ = 0.45 - ease * 0.25;
      }
    }

    const snapRate = this.clawSlashTimer > 0 ? 28 : 14;
    this.fpArms.leftArm.position.x = THREE.MathUtils.damp(this.fpArms.leftArm.position.x, targetLX, snapRate, dt);
    this.fpArms.leftArm.position.y = THREE.MathUtils.damp(this.fpArms.leftArm.position.y, targetLY, snapRate, dt);
    this.fpArms.leftArm.position.z = THREE.MathUtils.damp(this.fpArms.leftArm.position.z, targetLZ, snapRate, dt);
    this.fpArms.leftArm.rotation.x = THREE.MathUtils.damp(this.fpArms.leftArm.rotation.x, targetLRX, snapRate, dt);
    this.fpArms.leftArm.rotation.y = THREE.MathUtils.damp(this.fpArms.leftArm.rotation.y, targetLRY, snapRate, dt);
    this.fpArms.leftArm.rotation.z = THREE.MathUtils.damp(this.fpArms.leftArm.rotation.z, targetLRZ, snapRate, dt);

    this.fpArms.rightArm.position.x = THREE.MathUtils.damp(this.fpArms.rightArm.position.x, targetRX, snapRate, dt);
    this.fpArms.rightArm.position.y = THREE.MathUtils.damp(this.fpArms.rightArm.position.y, targetRY, snapRate, dt);
    this.fpArms.rightArm.position.z = THREE.MathUtils.damp(this.fpArms.rightArm.position.z, targetRZ, snapRate, dt);
    this.fpArms.rightArm.rotation.x = THREE.MathUtils.damp(this.fpArms.rightArm.rotation.x, targetRRX, snapRate, dt);
    this.fpArms.rightArm.rotation.y = THREE.MathUtils.damp(this.fpArms.rightArm.rotation.y, targetRRY, snapRate, dt);
    this.fpArms.rightArm.rotation.z = THREE.MathUtils.damp(this.fpArms.rightArm.rotation.z, targetRRZ, snapRate, dt);
  }

  private updateParticles(dt: number): void {
    let anyChanged = false;
    const mouthX = this.playerPos.x + Math.sin(this.playerYaw) * 0.22;
    const mouthY = this.playerPos.y + 1.44;
    const mouthZ = this.playerPos.z + Math.cos(this.playerYaw) * 0.22;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.homingToVampire = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      if (p.homingToVampire) {
        _v1.set(mouthX - p.pos.x, mouthY - p.pos.y, mouthZ - p.pos.z);
        const dist = _v1.length();
        if (dist > 0.04) {
          _v1.divideScalar(dist);
          const pullSpeed = 3.8 + (1 - p.life / p.maxLife) * 3.5;
          p.vel.x = THREE.MathUtils.damp(p.vel.x, _v1.x * pullSpeed, 12, dt);
          p.vel.y = THREE.MathUtils.damp(p.vel.y, _v1.y * pullSpeed, 12, dt);
          p.vel.z = THREE.MathUtils.damp(p.vel.z, _v1.z * pullSpeed, 12, dt);
        }
        p.pos.addScaledVector(p.vel, dt);
      } else {
        p.vel.y += p.gravity * dt;
        p.pos.addScaledVector(p.vel, dt);
      }
      const t = p.life / p.maxLife;
      _dummy.position.copy(p.pos);
      _dummy.scale.setScalar(p.scale * t);
      _dummy.rotation.set(t * 4, t * 3, 0);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (anyChanged) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateSoundRipples(dt: number): void {
    for (let i = 0; i < this.soundRipples.length; i++) {
      const r = this.soundRipples[i];
      if (!r.active) continue;
      r.life += dt;
      const prog = r.life / r.maxLife;
      if (prog >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const scale = 0.35 + prog * r.maxRadius;
      r.mesh.scale.setScalar(scale);
      r.mat.opacity = (1 - prog) * 0.52;
    }
  }

  private updateSmoke(dt: number): void {
    this.smokeSpawnTimer += dt;
    if (this.smokeSpawnTimer >= 0.16 && this.world.smokeSources.length > 0) {
      this.smokeSpawnTimer = 0;
      this.nearbySmokeIndices.length = 0;
      const maxDistSq = 48 * 48;
      for (let s = 0; s < this.world.smokeSources.length; s++) {
        const cand = this.world.smokeSources[s];
        const dx = cand.x - this.playerPos.x;
        const dz = cand.z - this.playerPos.z;
        if (dx * dx + dz * dz <= maxDistSq) {
          this.nearbySmokeIndices.push(s);
        }
      }

      if (this.nearbySmokeIndices.length > 0) {
        const pickedIdx =
          this.nearbySmokeIndices[Math.floor(Math.random() * this.nearbySmokeIndices.length)];
        const src = this.world.smokeSources[pickedIdx];
        const isGrate = src.y < 1.0;

        for (let i = 0; i < this.smokePuffs.length; i++) {
          const puff = this.smokePuffs[i];
          if (!puff.active) {
            puff.active = true;
            puff.isDark = false;
            puff.pos.set(
              src.x + (Math.random() - 0.5) * (isGrate ? 0.55 : 0.28),
              src.y,
              src.z + (Math.random() - 0.5) * (isGrate ? 0.55 : 0.28),
            );
            puff.vel.set(
              (Math.random() - 0.5) * 0.28,
              (isGrate ? 0.68 : 1.15) + Math.random() * 0.45,
              (Math.random() - 0.5) * 0.28,
            );
            puff.life = 0;
            puff.maxLife = (isGrate ? 2.5 : 3.2) + Math.random() * 1.2;
            puff.baseScale = (isGrate ? 0.42 : 0.72) + Math.random() * (isGrate ? 0.28 : 0.44);
            this.smokeMesh.setColorAt(i, _color.setHex(isGrate ? 0x8fa3ba : 0x64748b));
            if (this.smokeMesh.instanceColor) this.smokeMesh.instanceColor.needsUpdate = true;
            break;
          }
        }
      }
    }

    const wx = this.sharedUniforms.uWindDir.value.x * this.windStrength * 2.15;
    const wz = this.sharedUniforms.uWindDir.value.y * this.windStrength * 2.15;
    let changed = false;

    for (let i = 0; i < this.smokePuffs.length; i++) {
      const p = this.smokePuffs[i];
      if (!p.active) continue;
      changed = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.smokeMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      const prog = p.life / p.maxLife;
      p.pos.x += (p.vel.x + wx * (0.4 + prog * 1.1)) * dt;
      p.pos.y += p.vel.y * (1 - prog * 0.35) * dt;
      p.pos.z += (p.vel.z + wz * (0.4 + prog * 1.1)) * dt;

      const scale = p.baseScale * (0.65 + prog * 1.9) * (1 - prog * 0.6);
      _dummy.position.copy(p.pos);
      _dummy.scale.setScalar(Math.max(0.01, scale));
      _dummy.rotation.set(p.life * 0.5, p.life * 0.7, 0);
      _dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, _dummy.matrix);
    }

    if (changed) {
      this.smokeMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateAmbientMotes(dt: number): void {
    this.ambientMoteSpawnTimer += dt;
    let colorDirty = false;

    if (this.ambientMoteSpawnTimer >= 0.085) {
      this.ambientMoteSpawnTimer = 0;
      this.nearbyLampIndices.length = 0;
      const maxLampDistSq = 38 * 38;
      for (let i = 0; i < this.world.lamps.length; i++) {
        const lamp = this.world.lamps[i];
        if (!lamp.isLit) continue;
        const dx = lamp.position.x - this.playerPos.x;
        const dz = lamp.position.z - this.playerPos.z;
        if (dx * dx + dz * dz <= maxLampDistSq) {
          this.nearbyLampIndices.push(i);
        }
      }

      const cryptDx = 22.0 - this.playerPos.x;
      const cryptDz = -32.4 - this.playerPos.z;
      const nearBraziers = cryptDx * cryptDx + cryptDz * cryptDz <= 30 * 30;
      const roll = Math.random();

      for (let i = 0; i < this.ambientMotes.length; i++) {
        const m = this.ambientMotes[i];
        if (m.active) continue;

        if (nearBraziers && roll < 0.16) {
          const side = Math.random() < 0.5 ? -2.6 : 2.6;
          m.active = true;
          m.pos.set(
            22.0 + side + (Math.random() - 0.5) * 0.25,
            1.42 + Math.random() * 0.18,
            -32.4 + (Math.random() - 0.5) * 0.25,
          );
          m.vel.set((Math.random() - 0.5) * 0.24, 0.45 + Math.random() * 0.35, (Math.random() - 0.5) * 0.24);
          m.life = 0;
          m.maxLife = 1.2 + Math.random() * 0.8;
          m.baseScale = 0.75 + Math.random() * 0.4;
          this.ambientMoteMesh.setColorAt(i, _color.setHex(0xf87171));
          colorDirty = true;
          break;
        } else if (this.nearbyLampIndices.length > 0 && roll < 0.72) {
          const lamp =
            this.world.lamps[this.nearbyLampIndices[Math.floor(Math.random() * this.nearbyLampIndices.length)]];
          const angle = Math.random() * Math.PI * 2;
          const rad = 0.15 + Math.random() * 0.45;
          m.active = true;
          m.pos.set(
            lamp.position.x + Math.cos(angle) * rad,
            4.48 + Math.random() * 0.35,
            lamp.position.z + Math.sin(angle) * rad,
          );
          m.vel.set(
            (Math.random() - 0.5) * 0.22,
            0.22 + Math.random() * 0.26,
            (Math.random() - 0.5) * 0.22,
          );
          m.life = 0;
          m.maxLife = 1.4 + Math.random() * 0.9;
          m.baseScale = 0.55 + Math.random() * 0.45;
          this.ambientMoteMesh.setColorAt(
            i,
            _color.setHex(Math.random() < 0.55 ? 0xffb347 : 0xffd280),
          );
          colorDirty = true;
          break;
        } else if (this.nearbySmokeIndices.length > 0) {
          const src =
            this.world.smokeSources[
              this.nearbySmokeIndices[Math.floor(Math.random() * this.nearbySmokeIndices.length)]
            ];
          m.active = true;
          m.pos.set(
            src.x + (Math.random() - 0.5) * 0.65,
            src.y + Math.random() * 0.35,
            src.z + (Math.random() - 0.5) * 0.65,
          );
          m.vel.set(
            (Math.random() - 0.5) * 0.28,
            0.42 + Math.random() * 0.32,
            (Math.random() - 0.5) * 0.28,
          );
          m.life = 0;
          m.maxLife = 1.6 + Math.random() * 1.0;
          m.baseScale = 0.5 + Math.random() * 0.4;
          this.ambientMoteMesh.setColorAt(i, _color.setHex(0x94a3b8));
          colorDirty = true;
          break;
        }
        break;
      }
    }

    const wx = this.sharedUniforms.uWindDir.value.x * this.windStrength * 0.55;
    const wz = this.sharedUniforms.uWindDir.value.y * this.windStrength * 0.55;
    let matrixDirty = false;

    for (let i = 0; i < this.ambientMotes.length; i++) {
      const m = this.ambientMotes[i];
      if (!m.active) continue;
      matrixDirty = true;
      m.life += dt;
      if (m.life >= m.maxLife) {
        m.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.ambientMoteMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      const prog = m.life / m.maxLife;
      m.pos.x += (m.vel.x + wx * prog + Math.sin(m.life * 3.8 + i) * 0.14) * dt;
      m.pos.y += m.vel.y * dt;
      m.pos.z += (m.vel.z + wz * prog + Math.cos(m.life * 3.4 + i) * 0.14) * dt;

      const scale = m.baseScale * Math.sin(prog * Math.PI);
      _dummy.position.copy(m.pos);
      _dummy.scale.setScalar(Math.max(0.01, scale));
      _dummy.rotation.set(m.life * 2.1, m.life * 1.7, 0);
      _dummy.updateMatrix();
      this.ambientMoteMesh.setMatrixAt(i, _dummy.matrix);
    }

    if (matrixDirty) {
      this.ambientMoteMesh.instanceMatrix.needsUpdate = true;
    }
    if (colorDirty && this.ambientMoteMesh.instanceColor) {
      this.ambientMoteMesh.instanceColor.needsUpdate = true;
    }
  }

  private findNearbyMemoryFragment(): MemoryFragmentInstance | null {
    for (const mem of this.world.memories) {
      if (mem.collected) continue;
      const horiz = Math.hypot(mem.position.x - this.playerPos.x, mem.position.z - this.playerPos.z);
      const vert = Math.abs(mem.position.y - this.playerPos.y);
      if (horiz <= 2.8 && vert <= 1.8) {
        return mem;
      }
    }
    return null;
  }

  private triggerGameOver(reason: string): void {
    this.deathReason = reason;
    this.callbacks.onPhaseRequest('gameover');
    this.setPhase('gameover');
  }

  private computeContextPrompt(): ContextPrompt | null {
    if (this.feedTimer > 0) return null;

    const candidate = this.findFeedCandidate();
    if (candidate) {
      const hasCornice = this.hasSkill('rap_3b') || this.hasSkill('amal_nocturnal_stalker');
      return {
        type: 'feed',
        keyHint: 'F',
        label: candidate.isAerial
          ? hasCornice
            ? `Bote das Cornijas: ${candidate.npc.name}`
            : `Bote Aéreo Letal: ${candidate.npc.name}`
          : candidate.npc.hp <= 25 &&
            (candidate.npc.archetype === 'guard' ||
              candidate.npc.archetype === 'bodyguard' ||
              candidate.npc.archetype === 'hunter')
          ? `Executar e Drenar: ${candidate.npc.name}`
          : candidate.isStealth
          ? `Emboscada Letal: ${candidate.npc.name}`
          : `Drenar ${candidate.npc.name}`,
        isStealthKill: candidate.isStealth,
        isAerialKill: candidate.isAerial,
        targetName: candidate.npc.name,
      };
    }

    const nearCoffin =
      Math.hypot(this.playerPos.x - this.world.coffinPos.x, this.playerPos.z - this.world.coffinPos.z) <= 3.3 &&
      Math.abs(this.playerPos.y - this.world.coffinPos.y) <= 2.2;
    if (nearCoffin) {
      const quotaBonus = this.killsThisNight >= this.quotaThisNight ? 20 : 0;
      const totalToConsolidate = this.pendingEssence + quotaBonus;
      return {
        type: 'restCoffin',
        keyHint: 'E',
        label:
          quotaBonus > 0
            ? `Repousar no Caixão e Consolidar +${totalToConsolidate} Essência (+20 bônus)`
            : `Repousar no Caixão e Consolidar +${totalToConsolidate} Essência`,
      };
    }

    const bell = this.world.bells.find(
      (b) => !b.sabotaged && b.position.distanceTo(this.playerPos) <= 3.3,
    );
    if (bell) {
      return {
        type: 'sabotageBell',
        keyHint: 'E',
        label: `Sabotar ${bell.name}`,
      };
    }

    const memory = this.findNearbyMemoryFragment();
    if (memory) {
      return {
        type: 'memory',
        keyHint: 'E',
        label: `Coletar Memória: ${memory.title}`,
      };
    }

    const corpse = this.findNearbyExposedCorpse();
    if (corpse) {
      return {
        type: 'hideCorpse',
        keyHint: 'G',
        label: `Ocultar Corpo de ${corpse.name}`,
      };
    }

    if (this.canUsePower('snuffLamp') && this.cooldowns.snuffLamp <= 0) {
      const range = this.hasSkill('ten_3') ? 17 : 14;
      const nearbyLamp = this.world.lamps.find(
        (l) => l.isLit && l.position.distanceTo(this.playerPos) <= range,
      );
      if (nearbyLamp) {
        return {
          type: 'snuff',
          keyHint: formatKeyCodeLabel(this.hotkeys.snuffLamp),
          label: 'Apagar Lampião à Distância',
        };
      }
    }
    return null;
  }

  private pushHudSnapshot(force: boolean): void {
    if (!force && this.destroyed) return;
    let alertLevel: 'hidden' | 'curious' | 'caution' | 'hunted' = 'hidden';
    let hasFleeing = false;
    for (const npc of this.npcs) {
      if (npc.state === 'alert' || npc.state === 'hunt') {
        alertLevel = 'hunted';
        break;
      }
      if (npc.state === 'flee') {
        hasFleeing = true;
      }
      if (npc.state === 'suspicious' || npc.state === 'flee') {
        alertLevel = 'caution';
      } else if (npc.state === 'curious' && alertLevel === 'hidden') {
        alertLevel = 'curious';
      }
    }
    const alertStateLabel: 'Calmo' | 'Investigando' | 'Suspeito' | 'Alerta' =
      alertLevel === 'hunted' || hasFleeing
        ? 'Alerta'
        : alertLevel === 'caution'
        ? 'Suspeito'
        : alertLevel === 'curious'
        ? 'Investigando'
        : 'Calmo';

    const bellsSabotaged = this.world.bells.filter((b) => b.sabotaged).length;
    const weaknessesRecord: Record<string, string[]> = {};
    for (const [key, setVal] of Object.entries(this.discoveredWeaknesses)) {
      weaknessesRecord[key] = Array.from(setVal);
    }

    const currentDistrict = this.getDistrictAt(this.playerPos);
    const roundedInfamy: Record<DistrictId, number> = {
      cathedral: Math.round(this.districtInfamy.cathedral),
      alleys: Math.round(this.districtInfamy.alleys),
      avenue: Math.round(this.districtInfamy.avenue),
      cemetery: Math.round(this.districtInfamy.cemetery),
    };

    const isFeedActive = this.feedTimer > 0 && this.feedTarget !== null;
    const feedProgress = isFeedActive
      ? THREE.MathUtils.clamp(1 - this.feedTimer / Math.max(0.05, this.feedDuration), 0, 1)
      : 0;
    const feedMethodLabel = !isFeedActive
      ? null
      : this.feedTakedownKind === 'aerial'
      ? 'Bote Aéreo'
      : this.feedTakedownKind === 'noble'
      ? 'Beijo Aristocrático'
      : this.feedTakedownKind === 'guard'
      ? 'Emboscada Letal'
      : this.feedTakedownKind === 'cultist'
      ? 'Subjugação Sombria'
      : 'Abraço Silencioso';

    const nightProgress = Math.min(1, this.nightTimer / Math.max(1, this.nightDuration));
    const clockMins = Math.round(nightProgress * 300);
    const nightClockText = `${String(Math.floor(clockMins / 60)).padStart(2, '0')}:${String(clockMins % 60).padStart(2, '0')}`;
    const inSanctuary = this.isNearSafeSanctuary(this.playerPos);
    const inSafeCemetery = this.isInSafeCemetery(this.playerPos);
    const targetCryptX = this.world.coffinPos.x;
    const targetCryptZ = inSanctuary ? this.world.coffinPos.z : -33.6;
    const cryptDx = targetCryptX - this.playerPos.x;
    const cryptDz = targetCryptZ - this.playerPos.z;
    const cryptDistance = Math.round(Math.hypot(cryptDx, cryptDz));
    const camFwdX = -Math.sin(this.camYaw);
    const camFwdZ = -Math.cos(this.camYaw);
    const camRightX = Math.cos(this.camYaw);
    const camRightZ = -Math.sin(this.camYaw);
    const cryptBearingDeg = Math.round(
      THREE.MathUtils.radToDeg(
        Math.atan2(cryptDx * camRightX + cryptDz * camRightZ, cryptDx * camFwdX + cryptDz * camFwdZ),
      ),
    );
    const nearCoffinNow =
      inSanctuary &&
      Math.hypot(this.playerPos.x - this.world.coffinPos.x, this.playerPos.z - this.world.coffinPos.z) <= 3.3;
    const showCryptCompass =
      !nearCoffinNow &&
      (nightProgress >= 0.72 ||
        this.killsThisNight >= this.quotaThisNight);

    this.callbacks.onHudUpdate({
      health: Math.max(0, Math.round(this.health)),
      maxHealth: this.maxHealth,
      blood: Math.max(0, Math.round(this.blood)),
      maxBlood: this.maxBlood,
      essence: this.essence,
      pendingEssence: this.pendingEssence,
      exposure: Math.round(this.exposure),
      shadowImmersion: Math.round(this.shadowImmersion * 100) / 100,
      noiseLevel: Math.round(this.noiseLevel),
      globalSuspicion: Math.round(this.globalSuspicion),
      suspicionTier: this.getSuspicionTier(),
      weather: this.weather,
      weatherLabel: WEATHER_META[this.weather].label,
      weatherEffect: WEATHER_META[this.weather].effectLabel,
      bellsSabotaged,
      totalBells: this.world.bells.length,
      collectedMemories: [...this.collectedMemories],
      encounteredTargets: Array.from(this.encounteredTargets),
      discoveredWeaknesses: weaknessesRecord,
      huntLog: [...this.huntLog],
      currentDistrict,
      currentDistrictName: DISTRICT_META[currentDistrict].name,
      currentDistrictInfamy: roundedInfamy[currentDistrict],
      districtInfamy: roundedInfamy,
      isInSafeSanctuary: inSanctuary,
      isInSafeCemetery: inSafeCemetery,
      isCrouching: this.isCrouching || this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight'),
      isInShadow: this.exposure < 32,
      isCrimsonSense: this.isCrimsonSense,
      isObfuscated: this.obfuscateTimer > 0,
      isCelerity: this.celerityTimer > 0,
      isMistForm: this.mistFormTimer > 0,
      isFalseVisage: this.falseVisageTimer > 0,
      isAstralScout: this.astralActive,
      isAbyssalShroud: this.abyssalShroudTimer > 0,
      isShadowDecoyActive: this.shadowDecoyTimer > 0,
      powerRegenRemaining: Math.ceil(this.powerRegenTimer),
      isFeeding: isFeedActive,
      feedProgress,
      feedTargetName: isFeedActive && this.feedTarget ? this.feedTarget.name : null,
      feedMethodLabel,
      elevation: Math.round(this.playerPos.y * 10) / 10,
      alertLevel,
      alertStateLabel,
      nightNumber: this.nightNumber,
      nightProgress,
      nightClockText,
      isDawnApproaching: nightProgress >= 0.85 && nightProgress < 1.0,
      isDawnBurn: nightProgress >= 1.0 && !inSanctuary,
      canCompleteNight: this.killsThisNight >= this.quotaThisNight,
      cryptDistance,
      cryptBearingDeg,
      showCryptCompass,
      lastNightSummary: this.lastNightSummary,
      mainTargetName: this.mainTargetName,
      mainTargetDistrict: this.mainTargetDistrict,
      mainTargetDefeated: this.mainTargetDefeated,
      killsThisNight: this.killsThisNight,
      quotaThisNight: this.quotaThisNight,
      totalKills: this.totalKills,
      noblesDrained: this.noblesDrained,
      guardsSlain: this.guardsSlain,
      cooldowns: {
        shadowDash: this.cooldowns.shadowDash,
        shadowDashMax: this.getSkillCooldownMax('shadowDash'),
        snuffLamp: this.cooldowns.snuffLamp,
        snuffLampMax: this.getSkillCooldownMax('snuffLamp'),
        shadowSnare: this.cooldowns.shadowSnare,
        shadowSnareMax: this.getSkillCooldownMax('shadowSnare'),
        abyssalShroud: this.cooldowns.abyssalShroud,
        abyssalShroudMax: this.getSkillCooldownMax('abyssalShroud'),
        darknessPulse: this.cooldowns.darknessPulse,
        darknessPulseMax: this.getSkillCooldownMax('darknessPulse'),
        obfuscate: this.cooldowns.obfuscate,
        obfuscateMax: this.getSkillCooldownMax('obfuscate'),
        falseVisage: this.cooldowns.falseVisage,
        falseVisageMax: this.getSkillCooldownMax('falseVisage'),
        shadowDecoy: this.cooldowns.shadowDecoy,
        shadowDecoyMax: this.getSkillCooldownMax('shadowDecoy'),
        astralScout: this.cooldowns.astralScout,
        astralScoutMax: this.getSkillCooldownMax('astralScout'),
        dominate: this.cooldowns.dominate,
        dominateMax: this.getSkillCooldownMax('dominate'),
        memoryWipe: this.cooldowns.memoryWipe,
        memoryWipeMax: this.getSkillCooldownMax('memoryWipe'),
        possess: this.cooldowns.possess,
        possessMax: this.getSkillCooldownMax('possess'),
        batSwarm: this.cooldowns.batSwarm,
        batSwarmMax: this.getSkillCooldownMax('batSwarm'),
        mistForm: this.cooldowns.mistForm,
        mistFormMax: this.getSkillCooldownMax('mistForm'),
        celerity: this.cooldowns.celerity,
        celerityMax: this.getSkillCooldownMax('celerity'),
        shadowLeap: this.cooldowns.shadowLeap,
        shadowLeapMax: this.getSkillCooldownMax('shadowLeap'),
        shadowThrow: this.cooldowns.shadowThrow,
        shadowThrowMax: this.getSkillCooldownMax('shadowThrow'),
      },
      disciplines: { ...this.disciplines },
      unlockedSkills: Array.from(this.unlockedSkills),
      equippedPowers: [...this.equippedPowers],
      hotkeys: { ...this.hotkeys },
      contextPrompt: this.computeContextPrompt(),
      statusBanner: this.statusBanner,
      deathReason: this.deathReason,
      pointerLocked: this.pointerLocked,
    });
  }

  public dispose(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('blur', this.onBlurBound);
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDownBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    this.renderer.domElement.removeEventListener('wheel', this.onWheelBound);

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry?.dispose();
      }
    });
    this.composer?.dispose();
    this.skyMat.dispose();
    this.rainMat.dispose();
    this.shadowDecoyBodyMat.dispose();
    this.shadowDecoyRingMat.dispose();
    this.darknessPulseMat.dispose();
    (this.smokeMesh.material as THREE.Material).dispose();
    (this.ambientMoteMesh.material as THREE.Material).dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    for (const def of this.fpArms.stealthMatDefaults) {
      def.mat.dispose();
    }
    for (const def of this.vampire.stealthMatDefaults) {
      def.mat.dispose();
    }
    this.audio.dispose();
    this.mats.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
