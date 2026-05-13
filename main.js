import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as L from "./vendor/leaflet/leaflet.esm.js";
import { WEAPON_DATA, WEAPON_ORDER } from "./weapons.js";
import { ARMORY } from "./armory.js";
import { AIM9M_SBOM } from "./sbom.js";

const canvas = document.getElementById("scene");
const tooltipEl = document.getElementById("tooltip");
const tNameEl = document.getElementById("t-name");
const tClassEl = document.getElementById("t-class");
const tDescEl = document.getElementById("t-desc");
const tStatsEl = document.getElementById("t-stats");
const loadingEl = document.getElementById("loading");
const loaderFill = document.getElementById("loader-fill");
const loaderText = document.getElementById("loader-text");
const counterEl = document.getElementById("weapon-counter");

// ---------------------------------------------------------------------------
// Renderer / Scene / Camera
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9ed0ff, 80, 220);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
camera.position.set(14, 8, 16);

// ---------------------------------------------------------------------------
// Sky / environment — custom deep-blue gradient dome (lets us hit a much
// bluer sky than the physical Sky model's hazy horizon allows).
// ---------------------------------------------------------------------------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTop: { value: new THREE.Color(0x4a93dc) },
    uMid: { value: new THREE.Color(0x82b6e6) },
    uHoriz: { value: new THREE.Color(0xc4def0) },
  },
  vertexShader: /* glsl */ `
    varying vec3 vWorldDir;
    void main() {
      vWorldDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vWorldDir;
    uniform vec3 uTop;
    uniform vec3 uMid;
    uniform vec3 uHoriz;
    void main() {
      float h = clamp(vWorldDir.y, -0.2, 1.0);
      vec3 col;
      if (h < 0.25) {
        col = mix(uHoriz, uMid, smoothstep(0.0, 0.25, h));
      } else {
        col = mix(uMid, uTop, smoothstep(0.25, 0.9, h));
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat);
sky.renderOrder = -1;
scene.add(sky);

// Sun direction is still used to align the directional light.
const sunVec = new THREE.Vector3()
  .setFromSpherical(new THREE.Spherical(1, THREE.MathUtils.degToRad(45), THREE.MathUtils.degToRad(60)));

// Distinct fluffy clouds as camera-facing sprites scattered overhead.
function makeCloudPuffTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.clearRect(0, 0, size, size);

  // Build one fat cloud out of overlapping radial puffs.
  const cx = size / 2;
  const cy = size / 2;
  const puffs = [
    [cx, cy, size * 0.32, 0.95],
    [cx - 90, cy + 30, size * 0.25, 0.85],
    [cx + 100, cy + 20, size * 0.27, 0.85],
    [cx - 40, cy - 40, size * 0.22, 0.7],
    [cx + 60, cy - 50, size * 0.24, 0.75],
    [cx - 150, cy + 50, size * 0.18, 0.6],
    [cx + 160, cy + 60, size * 0.18, 0.6],
  ];
  for (const [x, y, r, a] of puffs) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0.0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.55, `rgba(245,250,255,${a * 0.4})`);
    grad.addColorStop(1.0, "rgba(220,230,245,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const cloudTex = makeCloudPuffTexture();
const cloudMat = new THREE.SpriteMaterial({
  map: cloudTex,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  fog: false,
});

const cloudsGroup = new THREE.Group();
const cloudCount = 36;
for (let i = 0; i < cloudCount; i++) {
  // Each sprite gets its own material clone so per-sprite rotation works.
  const sprite = new THREE.Sprite(cloudMat.clone());
  const angle = Math.random() * Math.PI * 2;
  const radius = 70 + Math.random() * 220;
  const altitude = 18 + Math.random() * 55;
  sprite.position.set(
    Math.cos(angle) * radius,
    altitude,
    Math.sin(angle) * radius
  );
  const s = 60 + Math.random() * 90;
  sprite.scale.set(s, s * 0.5, 1);
  sprite.material.rotation = (Math.random() - 0.5) * 0.6;
  sprite.userData.driftSpeed = 0.6 + Math.random() * 0.5;
  sprite.userData.driftAngle = Math.random() * Math.PI * 2;
  cloudsGroup.add(sprite);
}
scene.add(cloudsGroup);

// Keep the Sky mesh itself as the visible background (sharp gradient + sun);
// PMREM-blurred environment is only used for PBR lighting.
const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(sky, 0.04);
scene.environment = envRT.texture;

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xdaedff, 0x7e6f50, 1.55);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);

// Sunlight aligned with the sky's sun direction — gentle, not hot.
const sun = new THREE.DirectionalLight(0xfff4d6, 1.5);
sun.position.copy(sunVec).multiplyScalar(30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = -24;
sun.shadow.camera.right = 24;
sun.shadow.camera.top = 24;
sun.shadow.camera.bottom = -24;
sun.shadow.bias = -0.0005;
sun.shadow.radius = 10;
if ("intensity" in sun.shadow) sun.shadow.intensity = 0.55; // softer cast shadow
scene.add(sun);

const rim = new THREE.DirectionalLight(0x88aaff, 0.2);
rim.position.set(-12, 8, -14);
scene.add(rim);

const bounce = new THREE.DirectionalLight(0xffc080, 0.18);
bounce.position.set(-10, 2, 12);
scene.add(bounce);

// ---------------------------------------------------------------------------
// Ground — colorful tarmac painted procedurally on a canvas texture.
// ---------------------------------------------------------------------------
function makeTarmacTexture() {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");

  // Radial sunlit base — warm orange near the centre fading to slate-teal.
  const grad = g.createRadialGradient(size / 2, size / 2, 60, size / 2, size / 2, size * 0.55);
  grad.addColorStop(0.0, "#3a5d6e");
  grad.addColorStop(0.45, "#244258");
  grad.addColorStop(1.0, "#101a26");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  // Cool concrete pattern — slabs with grout lines.
  const slab = 80;
  g.strokeStyle = "rgba(255,255,255,0.04)";
  g.lineWidth = 2;
  for (let x = 0; x <= size; x += slab) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, size);
    g.stroke();
  }
  for (let y = 0; y <= size; y += slab) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y);
    g.stroke();
  }

  // Splotchy weathering noise.
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 4 + Math.random() * 18;
    const a = 0.02 + Math.random() * 0.05;
    g.fillStyle = `rgba(${180 + Math.random() * 70 | 0}, ${120 + Math.random() * 80 | 0}, ${70 + Math.random() * 60 | 0}, ${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // Hazard chevrons along the bottom edge — yellow/black caution stripe.
  g.save();
  g.translate(0, size - 80);
  for (let x = -80; x < size + 80; x += 60) {
    g.fillStyle = "#f0b020";
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 30, 0);
    g.lineTo(x + 60, 80);
    g.lineTo(x + 30, 80);
    g.closePath();
    g.fill();
    g.fillStyle = "#181818";
    g.beginPath();
    g.moveTo(x + 30, 0);
    g.lineTo(x + 60, 0);
    g.lineTo(x + 90, 80);
    g.lineTo(x + 60, 80);
    g.closePath();
    g.fill();
  }
  g.restore();

  // Centred runway-style aim marker (white + red dot).
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = 8;
  g.beginPath();
  g.arc(size / 2, size / 2, 70, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(220, 70, 50, 0.65)";
  g.beginPath();
  g.arc(size / 2, size / 2, 18, 0, Math.PI * 2);
  g.fill();

  // White cross-hair.
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(size / 2 - 110, size / 2);
  g.lineTo(size / 2 - 30, size / 2);
  g.moveTo(size / 2 + 30, size / 2);
  g.lineTo(size / 2 + 110, size / 2);
  g.moveTo(size / 2, size / 2 - 110);
  g.lineTo(size / 2, size / 2 - 30);
  g.moveTo(size / 2, size / 2 + 30);
  g.lineTo(size / 2, size / 2 + 110);
  g.stroke();

  // Stencilled text panels around the perimeter.
  g.fillStyle = "rgba(255,255,255,0.32)";
  g.font = "bold 44px 'Roboto Condensed', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const labels = ["HANGAR 03", "DANGER", "ARMED", "FOD ZONE"];
  labels.forEach((t, i) => {
    const a = (i / labels.length) * Math.PI * 2 + Math.PI / 4;
    const x = size / 2 + Math.cos(a) * size * 0.34;
    const y = size / 2 + Math.sin(a) * size * 0.34;
    g.save();
    g.translate(x, y);
    g.rotate(a + Math.PI / 2);
    g.fillText(t, 0, 0);
    g.restore();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const tarmacTex = makeTarmacTexture();
const floorGeo = new THREE.CircleGeometry(40, 128);
const floorMat = new THREE.MeshStandardMaterial({
  map: tarmacTex,
  roughness: 0.78,
  metalness: 0.05,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Far grass apron — a wider plane to fill horizon under the sky.
const apronMat = new THREE.MeshStandardMaterial({
  color: 0x4f6b3a,
  roughness: 0.95,
  metalness: 0,
});
const apron = new THREE.Mesh(new THREE.CircleGeometry(400, 64), apronMat);
apron.rotation.x = -Math.PI / 2;
apron.position.y = -0.02;
apron.receiveShadow = true;
scene.add(apron);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(11.6, 11.85, 128),
  new THREE.MeshBasicMaterial({ color: 0xffd368, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.02;
scene.add(ring);

const innerRing = new THREE.Mesh(
  new THREE.RingGeometry(6.0, 6.1, 128),
  new THREE.MeshBasicMaterial({ color: 0xffd368, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
);
innerRing.rotation.x = -Math.PI / 2;
innerRing.position.y = 0.02;
scene.add(innerRing);

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 38;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // keep above ground
controls.target.set(0, 1.6, 0);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};

// ---------------------------------------------------------------------------
// Asset loading
// ---------------------------------------------------------------------------
const loader = new GLTFLoader();

const progress = { aircraft: 0, missiles: 0 };
function updateLoader(label) {
  const pct = Math.round((progress.aircraft + progress.missiles) / 2);
  loaderFill.style.width = pct + "%";
  loaderText.textContent = label ?? `Loading hangar... ${pct}%`;
}
function onProgress(key) {
  return (event) => {
    if (event.lengthComputable) {
      progress[key] = (event.loaded / event.total) * 100;
    } else {
      progress[key] = Math.min(95, progress[key] + 5);
    }
    updateLoader();
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function frameObject(object, targetSize) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = targetSize / maxDim;
  object.scale.setScalar(scale);
  // Recenter horizontally; let bottom sit on ground.
  box.setFromObject(object);
  box.getSize(size);
  box.getCenter(center);
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y;
  return { size, center };
}

function enableShadows(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material && obj.material.isMeshStandardMaterial) {
        // Slight roughness bump so jet doesn't look glossy plastic.
        obj.material.envMapIntensity = 0.8;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Aircraft + Weapons load + layout
// ---------------------------------------------------------------------------
const aircraftGroup = new THREE.Group();
scene.add(aircraftGroup);

const weaponsGroup = new THREE.Group();
scene.add(weaponsGroup);

// Stand under each weapon — Warthunder hangar style.
function makeStand() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.12, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x2c4030, roughness: 0.7, metalness: 0.2 })
  );
  base.position.y = 0.06;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  for (const x of [-0.45, 0.45]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.5, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x1f2d22, roughness: 0.7, metalness: 0.2 })
    );
    post.position.set(x, 0.36, 0);
    post.castShadow = true;
    group.add(post);
  }

  const cradle = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.05, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x1f2d22, roughness: 0.7, metalness: 0.2 })
  );
  cradle.position.y = 0.62;
  cradle.castShadow = true;
  group.add(cradle);

  return group;
}

let aircraftMixer = null;
let aircraftAction = null;

function loadAircraft() {
  return new Promise((resolve, reject) => {
    loader.load(
      "assets/f15_aircraft.glb",
      (gltf) => {
        const root = gltf.scene;
        aircraftGroup.add(root);
        frameObject(root, 11.5); // target wingspan ~11.5 units
        enableShadows(root);

        const clip =
          THREE.AnimationClip.findByName(gltf.animations, "F-15|ArmatureAction") ??
          gltf.animations[0];
        if (clip) {
          aircraftMixer = new THREE.AnimationMixer(root);
          aircraftAction = aircraftMixer.clipAction(clip);
          aircraftAction.setLoop(THREE.LoopPingPong, Infinity);
          aircraftAction.clampWhenFinished = false;
          aircraftAction.timeScale = 0.45;
          aircraftAction.play();

          // The clip animates the landing gear / control surfaces. Box3 on a
          // SkinnedMesh only sees the bind-pose bounding box, so we can't
          // re-ground programmatically across the animation. Apply an empirical
          // offset that drops the fuselage close to the tarmac when the gear
          // is retracted (the gear simply tucks past the floor when extended).
          root.position.y -= 3.6;
        }

        resolve(root);
      },
      onProgress("aircraft"),
      reject
    );
  });
}

const weaponRefs = []; // [{ root, info, targetable: THREE.Object3D }]
let aim9mGlowMaterials = []; // emissive materials we'll pulse each frame
let aim9mDetailedSource = null; // pristine clone of the detailed model, for the assembly viewer

function loadWeapons() {
  return new Promise((resolve, reject) => {
    loader.load(
      "assets/missile_set.glb",
      (gltf) => {
        const root = gltf.scene;

        // GLB nodes are named like "AGM65 Maverick_0", but the GLTFLoader
        // sanitizes spaces into underscores ("AGM65_Maverick_0"). Match against
        // a normalized form of each catalog key.
        const weaponNodes = new Map();
        const normalize = (s) => s.replace(/ /g, "_");
        const keyByNorm = new Map(
          Object.keys(WEAPON_DATA).map((k) => [normalize(k), k])
        );

        root.traverse((node) => {
          if (!node.name) return;
          const baseName = node.name.replace(/_\d+$/, "");
          const realKey = keyByNorm.get(baseName);
          if (realKey && !weaponNodes.has(realKey)) {
            weaponNodes.set(realKey, node);
          }
        });

        const radius = 11.7;
        const ordered = WEAPON_ORDER.filter((k) => weaponNodes.has(k));
        const count = ordered.length;

        ordered.forEach((key, i) => {
          const node = weaponNodes.get(key);
          const info = WEAPON_DATA[key];

          // Detach from original parent and add to our weaponsGroup
          // (clone to avoid weird parent transforms baked into the original tree).
          const weapon = new THREE.Group();
          weapon.name = "weapon:" + key;
          weapon.userData.weapon = info;

          const clone = node.clone(true);
          // Reset clone's transform so it sits at the local origin.
          clone.position.set(0, 0, 0);
          clone.rotation.set(0, 0, 0);
          clone.scale.set(1, 1, 1);
          weapon.add(clone);

          // Normalize: center, scale to a uniform target size, and rotate so the
          // weapon's long axis points along local +Z (we then make that tangent
          // to the ring with rotation.y below).
          const box = new THREE.Box3().setFromObject(clone);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          clone.position.sub(center);

          // Detect long axis. If long axis isn't already Z, rotate clone so it is.
          // x>z => rotate 90° around Y; y>both => rotate 90° around X.
          if (size.x > size.z && size.x >= size.y) {
            clone.rotation.y += Math.PI / 2;
          } else if (size.y > size.z && size.y > size.x) {
            clone.rotation.x += Math.PI / 2;
          }

          // Re-evaluate bbox after rotation for accurate scaling/grounding.
          let reBox = new THREE.Box3().setFromObject(clone);
          const reSize = new THREE.Vector3();
          reBox.getSize(reSize);
          const longest = Math.max(reSize.x, reSize.y, reSize.z);
          const scaleTarget = 2.6 / longest;
          clone.scale.setScalar(scaleTarget);

          // Sit weapon on top of the stand cradle (~y=0.7).
          reBox = new THREE.Box3().setFromObject(clone);
          clone.position.y -= reBox.min.y;
          clone.position.y += 0.7;

          enableShadows(clone);

          // Evenly distribute weapons in a full ring around the aircraft.
          const angle = (i / count) * Math.PI * 2;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          weapon.position.set(x, 0, z);

          // Face the weapon so its long axis is tangent to the ring, broadside
          // visible from the center — same convention as the hangar reference.
          weapon.rotation.y = -angle;

          // Add the cradle under the weapon.
          const stand = makeStand();
          weapon.add(stand);

          weaponsGroup.add(weapon);
          weaponRefs.push({ root: weapon, clone, info, key });
        });

        if (counterEl) counterEl.textContent = `${count} / ${WEAPON_ORDER.length}`;

        resolve();
      },
      onProgress("missiles"),
      reject
    );
  });
}

// Swap the AIM-9 Sidewinder slot for the high-detail AIM-9M model and tint
// it with a pulsing glow so it visually pops as the "featured" weapon.
function loadAim9mDetailed() {
  return new Promise((resolve, reject) => {
    loader.load(
      "assets/aim9m.glb",
      (gltf) => {
        const source = gltf.scene;
        aim9mDetailedSource = source;

        const slot = weaponRefs.find((w) => w.key === "AIM-9 Sidewinder");
        if (!slot) return resolve();

        // Take a copy for the in-ring slot; keep the original for the assembly view.
        const replacement = source.clone(true);
        replacement.position.set(0, 0, 0);
        replacement.rotation.set(0, 0, 0);
        replacement.scale.set(1, 1, 1);

        // Normalize: center, longest-axis-along-Z, target size, sit on cradle.
        {
          const b = new THREE.Box3().setFromObject(replacement);
          const c = new THREE.Vector3(); b.getCenter(c);
          replacement.position.sub(c);

          const s = new THREE.Vector3(); b.getSize(s);
          if (s.x > s.z && s.x >= s.y) replacement.rotation.y += Math.PI / 2;
          else if (s.y > s.z && s.y > s.x) replacement.rotation.x += Math.PI / 2;

          const b2 = new THREE.Box3().setFromObject(replacement);
          const s2 = new THREE.Vector3(); b2.getSize(s2);
          const longest = Math.max(s2.x, s2.y, s2.z);
          replacement.scale.setScalar(2.6 / longest);

          const b3 = new THREE.Box3().setFromObject(replacement);
          replacement.position.y -= b3.min.y;
          replacement.position.y += 0.7;
        }

        // Apply the pulsing accent emissive — collect materials so the tick
        // loop can pulse them in sync.
        aim9mGlowMaterials.length = 0;
        replacement.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.castShadow = true;
          obj.receiveShadow = true;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (!m || !("emissive" in m)) return;
            m.emissive = new THREE.Color(0xffb84a);
            m.emissiveIntensity = 0.6;
            m.toneMapped = true;
            aim9mGlowMaterials.push(m);
          });
        });

        // Replace the in-ring clone.
        slot.root.remove(slot.clone);
        slot.root.add(replacement);
        slot.clone = replacement;

        resolve();
      },
      undefined,
      reject
    );
  });
}

// ---------------------------------------------------------------------------
// Hover detection (raycaster)
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
let hoveredWeapon = null;
let hoverIntensity = new Map(); // weapon key -> 0..1
const emissiveCache = new WeakMap();

function setHoverEmissive(weaponRef, on) {
  const color = on ? new THREE.Color(0xffb84a) : new THREE.Color(0x000000);
  const intensity = on ? 0.35 : 0;
  weaponRef.clone.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!("emissive" in m)) return;
      if (!emissiveCache.has(m)) {
        emissiveCache.set(m, {
          color: m.emissive.clone(),
          intensity: m.emissiveIntensity ?? 1,
        });
      }
      const orig = emissiveCache.get(m);
      m.emissive.copy(on ? color : orig.color);
      m.emissiveIntensity = on ? intensity : orig.intensity;
      m.needsUpdate = true;
    });
  });
}

function updateTooltipPosition(clientX, clientY) {
  const pad = 16;
  const rect = tooltipEl.getBoundingClientRect();
  let x = clientX + pad;
  let y = clientY + pad;
  if (x + rect.width > window.innerWidth - 8) {
    x = clientX - rect.width - pad;
  }
  if (y + rect.height > window.innerHeight - 8) {
    y = clientY - rect.height - pad;
  }
  tooltipEl.style.transform = `translate(${x}px, ${y}px)`;
}

function showTooltip(info, clientX, clientY) {
  tNameEl.textContent = info.name;
  tClassEl.textContent = info.class;
  tDescEl.textContent = info.desc;
  tStatsEl.innerHTML = "";
  for (const [k, v] of Object.entries(info.stats)) {
    const kd = document.createElement("div");
    kd.className = "k";
    kd.textContent = k;
    const vd = document.createElement("div");
    vd.className = "v";
    vd.textContent = v;
    tStatsEl.appendChild(kd);
    tStatsEl.appendChild(vd);
  }
  tooltipEl.classList.remove("hidden");
  updateTooltipPosition(clientX, clientY);
}

function hideTooltip() {
  tooltipEl.classList.add("hidden");
}

let lastClientX = 0;
let lastClientY = 0;

canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  lastClientX = e.clientX;
  lastClientY = e.clientY;
  if (hoveredWeapon) updateTooltipPosition(e.clientX, e.clientY);
});

canvas.addEventListener("pointerleave", () => {
  pointer.set(-10, -10);
  if (hoveredWeapon) {
    setHoverEmissive(hoveredWeapon, false);
    hoveredWeapon = null;
    hideTooltip();
  }
});

// ---------------------------------------------------------------------------
// Click-to-open side panel
// ---------------------------------------------------------------------------
const panelEl = document.getElementById("panel");
const panelName = document.getElementById("p-name");
const panelClass = document.getElementById("p-class");
const iStorage = document.getElementById("i-storage");
const iReady = document.getElementById("i-ready");
const iMaint = document.getElementById("i-maint");
const iNeeds = document.getElementById("i-needs");
const logEl = document.getElementById("p-log");
const panelCloseBtn = document.getElementById("p-close");

const mapModal = document.getElementById("map-modal");
const mapTitle = document.getElementById("m-title");
const mapSub = document.getElementById("m-sub");
const mapCloseBtn = document.getElementById("m-close");

function fmtCoord(lat, lng) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}° ${ns}, ${Math.abs(lng).toFixed(3)}° ${ew}`;
}

function openPanel(weaponKey) {
  const info = WEAPON_DATA[weaponKey];
  const armory = ARMORY[weaponKey];
  if (!info || !armory) return;

  panelName.textContent = info.name;
  panelClass.textContent = info.class;
  iStorage.textContent = armory.inventory.storage;
  iReady.textContent = armory.inventory.ready;
  iMaint.textContent = armory.inventory.maintenance;
  iNeeds.textContent = armory.inventory.needs;

  logEl.innerHTML = "";
  for (const use of armory.uses) {
    const entry = document.createElement("div");
    entry.className = "log-entry";

    const row = document.createElement("div");
    row.className = "log-row";
    const pilot = document.createElement("div");
    pilot.className = "log-pilot";
    pilot.textContent = use.pilot;
    const date = document.createElement("div");
    date.className = "log-date";
    date.textContent = use.date;
    row.appendChild(pilot);
    row.appendChild(date);
    entry.appendChild(row);

    const target = document.createElement("div");
    target.className = "log-target";
    target.textContent = use.target;
    entry.appendChild(target);

    const coord = document.createElement("button");
    coord.className = "log-coord";
    coord.type = "button";
    coord.textContent = fmtCoord(use.lat, use.lng);
    coord.addEventListener("click", () => openMap(info.name, use));
    entry.appendChild(coord);

    logEl.appendChild(entry);
  }

  panelEl.classList.remove("closed");
  panelEl.setAttribute("aria-hidden", "false");
}

function closePanel() {
  panelEl.classList.add("closed");
  panelEl.setAttribute("aria-hidden", "true");
}

panelCloseBtn.addEventListener("click", closePanel);

// Distinguish click from drag so orbiting the camera doesn't trigger picks.
let downAt = null;
canvas.addEventListener("pointerdown", (e) => {
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener("pointerup", (e) => {
  if (!downAt) return;
  const dx = e.clientX - downAt.x;
  const dy = e.clientY - downAt.y;
  downAt = null;
  if (Math.hypot(dx, dy) > 6) return; // it was a drag (orbit/pan), not a click

  // Use the current raycast hit (computed each frame in tick()).
  if (hoveredWeapon) {
    openPanel(hoveredWeapon.key);
  }
});

// ---------------------------------------------------------------------------
// Leaflet map modal — opens on coordinate click in the engagement log
// ---------------------------------------------------------------------------
let leafletMap = null;
let leafletMarker = null;

function ensureMap() {
  if (leafletMap) return leafletMap;
  leafletMap = L.map("map", {
    worldCopyJump: true,
    zoomControl: true,
    attributionControl: true,
  }).setView([0, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(leafletMap);
  return leafletMap;
}

function openMap(weaponName, use) {
  mapTitle.textContent = `${weaponName} — strike location`;
  mapSub.textContent = `${use.pilot} · ${use.date} · ${fmtCoord(use.lat, use.lng)}`;
  mapModal.classList.remove("hidden");
  mapModal.setAttribute("aria-hidden", "false");

  // Init/refresh after the modal is visible so Leaflet can size correctly.
  requestAnimationFrame(() => {
    const map = ensureMap();
    map.invalidateSize();
    map.flyTo([use.lat, use.lng], 7, { duration: 0.8 });
    if (leafletMarker) leafletMarker.remove();
    leafletMarker = L.marker([use.lat, use.lng])
      .addTo(map)
      .bindPopup(`<b>${weaponName}</b><br>${use.target}<br><small>${use.pilot} — ${use.date}</small>`)
      .openPopup();
  });
}

function closeMap() {
  mapModal.classList.add("hidden");
  mapModal.setAttribute("aria-hidden", "true");
}

mapCloseBtn.addEventListener("click", closeMap);
mapModal.addEventListener("click", (e) => {
  if (e.target === mapModal) closeMap();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!assemblyModal.classList.contains("hidden")) closeAssembly();
  else if (!mapModal.classList.contains("hidden")) closeMap();
  else if (!panelEl.classList.contains("closed")) closePanel();
});

// ---------------------------------------------------------------------------
// Right-click → AIM-9M assembly viewer (independent Three.js scene + SBOM)
// ---------------------------------------------------------------------------
const assemblyModal = document.getElementById("assembly-modal");
const assemblyCloseBtn = document.getElementById("assembly-close");
const assemblyCanvas = document.getElementById("assembly-canvas");
const assemblyLabels = document.getElementById("assembly-labels");
const assemblyStage = document.getElementById("assembly-stage");
const sbomPanel = document.getElementById("sbom-panel");
const sbomList = document.getElementById("sbom-list");
const sbomBuild = document.getElementById("sbom-build");
const sbomNcage = document.getElementById("sbom-ncage");
const sbomItar = document.getElementById("sbom-itar");

let asmRenderer = null;
let asmScene = null;
let asmCamera = null;
let asmControls = null;
let asmModel = null;
let asmSectionGroups = [];   // [{ group, label, color, baseZ }]
let asmRaf = 0;
let asmStartTime = 0;
let asmExploded = false;

function initAssemblyScene() {
  if (asmRenderer) return;
  asmRenderer = new THREE.WebGLRenderer({ canvas: assemblyCanvas, antialias: true, alpha: true });
  asmRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  asmRenderer.outputColorSpace = THREE.SRGBColorSpace;
  asmRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  asmRenderer.toneMappingExposure = 1.1;

  asmScene = new THREE.Scene();
  asmScene.background = null; // shows the radial CSS gradient behind

  const hemiA = new THREE.HemisphereLight(0xcfe2ff, 0x2a2436, 1.0);
  asmScene.add(hemiA);
  const ambA = new THREE.AmbientLight(0xffffff, 0.4);
  asmScene.add(ambA);
  const keyA = new THREE.DirectionalLight(0xfff4d6, 1.8);
  keyA.position.set(8, 6, 9);
  asmScene.add(keyA);
  const rimA = new THREE.DirectionalLight(0x80aaff, 0.65);
  rimA.position.set(-8, 3, -6);
  asmScene.add(rimA);

  asmCamera = new THREE.PerspectiveCamera(28, 1, 0.05, 200);
  asmCamera.position.set(0.3, 0.4, 15);
  asmCamera.lookAt(0, 0, 0);

  // Same control scheme as the main hangar view (LMB rotate, wheel zoom,
  // RMB pan), plus a gentle auto-rotation during the intro so the user
  // sees the assembly from multiple angles without having to drag.
  asmControls = new OrbitControls(asmCamera, assemblyCanvas);
  asmControls.enableDamping = true;
  asmControls.dampingFactor = 0.08;
  asmControls.minDistance = 5;
  asmControls.maxDistance = 30;
  asmControls.target.set(0, 0, 0);
  asmControls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  asmControls.autoRotate = true;
  asmControls.autoRotateSpeed = 0.6;
  // Any user interaction stops the auto-rotate so it doesn't fight the user.
  ["pointerdown", "wheel"].forEach((ev) =>
    assemblyCanvas.addEventListener(ev, () => { if (asmControls) asmControls.autoRotate = false; })
  );

  resizeAssembly();
}

function resizeAssembly() {
  if (!asmRenderer) return;
  const w = assemblyCanvas.clientWidth;
  const h = assemblyCanvas.clientHeight;
  asmRenderer.setSize(w, h, false);
  asmCamera.aspect = w / h;
  asmCamera.updateProjectionMatrix();
}
window.addEventListener("resize", resizeAssembly);

function buildAssemblyModel() {
  if (!aim9mDetailedSource) return;

  if (asmModel) {
    asmScene.remove(asmModel);
    asmModel.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => m.dispose?.());
      }
    });
  }
  asmSectionGroups.length = 0;

  const model = aim9mDetailedSource.clone(true);
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);

  // Normalize: center; longest axis along X (broadside to camera); target size.
  let b = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3(); b.getCenter(center);
  model.position.sub(center);

  const size = new THREE.Vector3(); b.getSize(size);
  if (size.z > size.x && size.z >= size.y) model.rotation.y += Math.PI / 2;
  else if (size.y > size.x && size.y > size.z) model.rotation.z += Math.PI / 2;

  b = new THREE.Box3().setFromObject(model);
  const sz = new THREE.Vector3(); b.getSize(sz);
  const longest = Math.max(sz.x, sz.y, sz.z);
  const targetLen = 8.5;
  model.scale.setScalar(targetLen / longest);

  // Re-center after scale.
  b = new THREE.Box3().setFromObject(model);
  const cc = new THREE.Vector3(); b.getCenter(cc);
  model.position.sub(cc);

  // Apply a subtle base material treatment + give each mesh a clone so we
  // can recolour by section without affecting the ring instance.
  model.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => m.clone?.() ?? m);
    } else {
      obj.material = obj.material.clone?.() ?? obj.material;
    }
    obj.castShadow = false;
    obj.receiveShadow = false;
    obj.visible = true;
  });

  asmScene.add(model);
  asmModel = model;

  // Group meshes into SBOM sections by sorting all meshes along the missile's
  // long axis, then partitioning them by COUNT into buckets sized to the
  // SBOM weights. Bucketing by count avoids the trap where one short physical
  // section (a sparse rocket motor tube) ends up with all meshes while another
  // (a mesh-dense seeker) gets zero.
  const sections = AIM9M_SBOM.sections;
  // Roughly the real-world AIM-9M section length proportions, nose→tail.
  const weights = [0.10, 0.12, 0.17, 0.36, 0.14, 0.11];
  while (weights.length < sections.length) weights.push(1 / sections.length);

  // Collect every leaf mesh + its world X.
  const tmp = new THREE.Vector3();
  const meshList = [];
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.getWorldPosition(tmp);
    meshList.push({ mesh: obj, x: tmp.x });
  });
  meshList.sort((a, b) => a.x - b.x);
  const total = meshList.length;

  // Compute bucket boundary indices.
  const boundaries = [0];
  let cum = 0;
  for (let i = 0; i < sections.length; i++) {
    cum += weights[i];
    boundaries.push(Math.round(cum * total));
  }
  // Guarantee at least one mesh per bucket where possible.
  for (let i = 1; i < boundaries.length; i++) {
    if (boundaries[i] <= boundaries[i - 1]) boundaries[i] = Math.min(total, boundaries[i - 1] + 1);
  }

  // Build section groups + assign meshes.
  for (let i = 0; i < sections.length; i++) {
    const grp = new THREE.Group();
    grp.userData.sectionId = sections[i].id;
    grp.userData.color = sections[i].color;
    grp.userData.label = sections[i].label;
    asmScene.add(grp);
    asmSectionGroups.push({
      group: grp,
      sectionIndex: i,
      color: sections[i].color,
      label: sections[i].label,
      originX: 0,
      meshCount: 0,
    });
  }

  for (let i = 0; i < sections.length; i++) {
    const grp = asmSectionGroups[i].group;
    const lo = boundaries[i];
    const hi = boundaries[i + 1];
    let sx = 0, count = 0;
    for (let j = lo; j < hi; j++) {
      const m = meshList[j].mesh;
      m.getWorldPosition(tmp);
      sx += tmp.x; count++;
      grp.attach(m); // preserves world transform
    }
    asmSectionGroups[i].meshCount = count;
    asmSectionGroups[i].originX = grp.position.x; // 0

    // Tint emissive so each section reads visually even in the assembled view.
    const color = new THREE.Color(asmSectionGroups[i].color);
    grp.traverse((m) => {
      if (!m.isMesh || !m.material) return;
      const ms = Array.isArray(m.material) ? m.material : [m.material];
      ms.forEach((mat) => {
        if (!("emissive" in mat)) return;
        mat.emissive = color.clone();
        mat.emissiveIntensity = 0.2;
      });
    });
  }

  // Remove the now-empty wrapper so it isn't traversed during rendering.
  asmScene.remove(model);
}

function explodeAssembly(progress) {
  // progress: 0 (assembled) → 1 (fully exploded)
  const sep = 1.4; // gap between adjacent sections at full explode
  const center = (asmSectionGroups.length - 1) / 2;
  for (let i = 0; i < asmSectionGroups.length; i++) {
    const ref = asmSectionGroups[i];
    const offset = (i - center) * sep * progress;
    ref.group.position.x = ref.originX + offset;
  }
}

function projectToScreen(worldPoint) {
  const v = worldPoint.clone().project(asmCamera);
  const rect = assemblyCanvas.getBoundingClientRect();
  return {
    x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
  };
}

function updateAssemblyLabels() {
  if (!asmSectionGroups.length) return;
  const canvasRect = assemblyCanvas.getBoundingClientRect();
  for (let i = 0; i < asmSectionGroups.length; i++) {
    const ref = asmSectionGroups[i];
    const labelEl = ref.labelEl;
    if (!labelEl) continue;
    if (ref.meshCount === 0) {
      labelEl.classList.remove("visible");
      labelEl.style.display = "none";
      continue;
    }
    labelEl.style.display = "";
    const target = new THREE.Vector3();
    ref.group.getWorldPosition(target);
    // Above placement: label sits up; Below: label sits down. The leader line
    // (rendered via CSS pseudo) bridges the screen-space gap to the part.
    target.y += ref.placement === "above" ? 1.05 : -1.05;
    const p = projectToScreen(target);
    labelEl.style.left = `${p.x - canvasRect.left}px`;
    labelEl.style.top = `${p.y - canvasRect.top}px`;
  }
}

function renderSbom() {
  sbomBuild.textContent = AIM9M_SBOM.buildId;
  sbomNcage.textContent = `NCAGE ${AIM9M_SBOM.ncage}`;
  sbomItar.textContent = AIM9M_SBOM.exportControl;

  sbomList.innerHTML = "";
  AIM9M_SBOM.sections.forEach((sec, idx) => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "sbom-section";
    sectionEl.style.transitionDelay = `${idx * 80}ms`;

    const head = document.createElement("div");
    head.className = "sbom-section-head";
    const dot = document.createElement("span");
    dot.className = "sbom-section-dot";
    dot.style.color = sec.color;
    dot.style.background = sec.color;
    const name = document.createElement("span");
    name.className = "sbom-section-name";
    name.textContent = sec.label;
    head.appendChild(dot);
    head.appendChild(name);
    sectionEl.appendChild(head);

    const desc = document.createElement("div");
    desc.className = "sbom-section-desc";
    desc.textContent = sec.desc;
    sectionEl.appendChild(desc);

    sec.components.forEach((c) => {
      const row = document.createElement("div");
      row.className = "sbom-comp";
      const left = document.createElement("div");
      const right = document.createElement("div");
      const top = document.createElement("div");
      top.className = "name";
      top.textContent = c.name;
      const bottom = document.createElement("div");
      bottom.className = "vendor";
      bottom.textContent = `${c.vendor} · ${c.license}`;
      left.appendChild(top);
      left.appendChild(bottom);
      const ver = document.createElement("div");
      ver.className = "ver";
      ver.textContent = `v${c.version}`;
      const hash = document.createElement("div");
      hash.className = "hash";
      hash.textContent = c.hash;
      right.appendChild(ver);
      right.appendChild(hash);
      row.appendChild(left);
      row.appendChild(right);
      sectionEl.appendChild(row);
    });

    sbomList.appendChild(sectionEl);
    requestAnimationFrame(() => sectionEl.classList.add("in"));
  });
}

function createLabels() {
  assemblyLabels.innerHTML = "";
  asmSectionGroups.forEach((ref, i) => {
    const el = document.createElement("div");
    const placement = i % 2 === 0 ? "above" : "below";
    el.className = `asm-label ${placement}`;
    el.textContent = ref.label;
    el.style.setProperty("--leader", ref.color);
    el.style.boxShadow = `0 0 12px ${ref.color}55`;
    assemblyLabels.appendChild(el);
    ref.labelEl = el;
    ref.placement = placement;
  });
}

function showLabels() {
  asmSectionGroups.forEach((r, i) => {
    setTimeout(() => r.labelEl?.classList.add("visible"), i * 90);
  });
}

function hideLabels() {
  for (const r of asmSectionGroups) r.labelEl?.classList.remove("visible");
}

function runAssemblyLoop() {
  cancelAnimationFrame(asmRaf);
  const explodeDur = 1400; // ms
  const sbomDelay = explodeDur + 200;
  let sbomShown = false;
  let labelsShown = false;

  const loop = () => {
    const now = performance.now();
    const elapsed = now - asmStartTime;
    if (!asmExploded) {
      const p = Math.min(1, elapsed / explodeDur);
      // ease-out quint
      const e = 1 - Math.pow(1 - p, 5);
      explodeAssembly(e);
      assemblyStage.textContent = e < 1
        ? `Separating ${asmSectionGroups.length} sections… ${Math.round(e * 100)}%`
        : "Assembly resolved · LMB orbit · Wheel zoom · RMB pan";
      if (p >= 1) asmExploded = true;
    }

    if (asmControls) asmControls.update();
    updateAssemblyLabels();
    if (!labelsShown && elapsed > 250) {
      showLabels();
      labelsShown = true;
    }
    if (!sbomShown && elapsed > sbomDelay) {
      renderSbom();
      sbomPanel.classList.add("visible");
      sbomShown = true;
    }

    asmRenderer.render(asmScene, asmCamera);
    asmRaf = requestAnimationFrame(loop);
  };
  asmRaf = requestAnimationFrame(loop);
}

function openAssembly() {
  initAssemblyScene();
  assemblyModal.classList.remove("hidden");
  assemblyModal.setAttribute("aria-hidden", "false");
  sbomPanel.classList.remove("visible");
  // Wait for layout so the canvas knows its size.
  requestAnimationFrame(() => {
    resizeAssembly();
    buildAssemblyModel();
    createLabels();
    hideLabels();
    if (asmControls) {
      asmCamera.position.set(0.3, 0.4, 15);
      asmControls.target.set(0, 0, 0);
      asmControls.autoRotate = true;
      asmControls.update();
    }
    asmExploded = false;
    asmStartTime = performance.now();
    runAssemblyLoop();
  });
}

function closeAssembly() {
  assemblyModal.classList.add("hidden");
  assemblyModal.setAttribute("aria-hidden", "true");
  sbomPanel.classList.remove("visible");
  cancelAnimationFrame(asmRaf);
  asmRaf = 0;
  if (asmControls) asmControls.autoRotate = false;
}

assemblyCloseBtn.addEventListener("click", closeAssembly);

// Right-click on the AIM-9M opens the assembly viewer.
canvas.addEventListener("contextmenu", (e) => {
  // Use current hover; we keep pointer position fresh per frame.
  if (hoveredWeapon && hoveredWeapon.key === "AIM-9 Sidewinder") {
    e.preventDefault();
    openAssembly();
  }
});

// Tiny escape hatch so the headless tests (and the curious user) can pop the
// assembly viewer without having to navigate the 3D ring.
window.__hangar = Object.freeze({ openAssembly, closeAssembly });

function pickWeapon() {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(weaponsGroup, true);
  if (intersects.length === 0) return null;
  // Walk up to find the weapon root group.
  let obj = intersects[0].object;
  while (obj && !obj.userData.weapon) obj = obj.parent;
  if (!obj) return null;
  return weaponRefs.find((w) => w.root === obj) ?? null;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  controls.update();

  const picked = pickWeapon();
  if (picked !== hoveredWeapon) {
    if (hoveredWeapon) setHoverEmissive(hoveredWeapon, false);
    hoveredWeapon = picked;
    if (hoveredWeapon) {
      setHoverEmissive(hoveredWeapon, true);
      showTooltip(hoveredWeapon.info, lastClientX, lastClientY);
    } else {
      hideTooltip();
    }
  }

  if (aircraftMixer) aircraftMixer.update(dt);

  // Restore visible hover bob on top of the rig animation.
  if (aircraftGroup.children.length) {
    const t = performance.now() * 0.001;
    aircraftGroup.position.y = Math.sin(t * 0.8) * 0.18 + 0.18;
    aircraftGroup.rotation.y = Math.sin(t * 0.05) * 0.008;
  }

  // Pulse the AIM-9M glow.
  if (aim9mGlowMaterials.length) {
    const t = performance.now() * 0.001;
    const v = 0.45 + Math.sin(t * 2.4) * 0.25;
    for (const m of aim9mGlowMaterials) m.emissiveIntensity = v;
  }

  // Slow individual drift for each cloud sprite.
  for (const cloud of cloudsGroup.children) {
    cloud.position.x += Math.cos(cloud.userData.driftAngle) * cloud.userData.driftSpeed * dt;
    cloud.position.z += Math.sin(cloud.userData.driftAngle) * cloud.userData.driftSpeed * dt;
    // Wrap around if the cloud drifts too far.
    const r = Math.hypot(cloud.position.x, cloud.position.z);
    if (r > 360) {
      cloud.userData.driftAngle += Math.PI;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function onResize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  onResize();
  try {
    await Promise.all([loadAircraft(), loadWeapons()]);
    await loadAim9mDetailed(); // depends on the AIM-9 slot existing
  } catch (err) {
    console.error("Failed to load hangar assets:", err);
    loaderText.textContent = "Failed to load assets — check console";
    return;
  }

  // Aircraft stays in its native orientation; the user can orbit to taste.

  updateLoader("Ready");
  setTimeout(() => loadingEl.classList.add("hidden"), 400);
  tick();
}

boot();
