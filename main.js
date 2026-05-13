import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { WEAPON_DATA, WEAPON_ORDER } from "./weapons.js";

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
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1014);
scene.fog = new THREE.Fog(0x0a1014, 35, 95);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.6).texture;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
camera.position.set(14, 8, 16);

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x1a1208, 0.45);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xfff1d0, 2.1);
keyLight.position.set(14, 20, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 60;
keyLight.shadow.camera.left = -22;
keyLight.shadow.camera.right = 22;
keyLight.shadow.camera.top = 22;
keyLight.shadow.camera.bottom = -22;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x88aaff, 0.8);
rimLight.position.set(-12, 8, -14);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xffaf6b, 0.35);
fillLight.position.set(-10, 4, 12);
scene.add(fillLight);

// Subtle accent spot from above to mimic hangar spotlight on the jet.
const spot = new THREE.SpotLight(0xfff2c2, 1.2, 60, Math.PI / 6, 0.5, 1.2);
spot.position.set(0, 22, 0);
spot.target.position.set(0, 0, 0);
scene.add(spot);
scene.add(spot.target);

// ---------------------------------------------------------------------------
// Ground (hangar floor)
// ---------------------------------------------------------------------------
const floorGeo = new THREE.CircleGeometry(40, 96);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x1a1f24,
  roughness: 0.85,
  metalness: 0.1,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(11.6, 11.8, 128),
  new THREE.MeshBasicMaterial({ color: 0xffb84a, side: THREE.DoubleSide, transparent: true, opacity: 0.18 })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.01;
scene.add(ring);

const innerRing = new THREE.Mesh(
  new THREE.RingGeometry(6.0, 6.08, 128),
  new THREE.MeshBasicMaterial({ color: 0xffb84a, side: THREE.DoubleSide, transparent: true, opacity: 0.1 })
);
innerRing.rotation.x = -Math.PI / 2;
innerRing.position.y = 0.01;
scene.add(innerRing);

const grid = new THREE.GridHelper(60, 60, 0x223038, 0x101418);
grid.position.y = 0.005;
scene.add(grid);

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

function loadAircraft() {
  return new Promise((resolve, reject) => {
    loader.load(
      "assets/f15_aircraft.glb",
      (gltf) => {
        const root = gltf.scene;
        aircraftGroup.add(root);
        frameObject(root, 11.5); // target wingspan ~11.5 units
        enableShadows(root);
        resolve(root);
      },
      onProgress("aircraft"),
      reject
    );
  });
}

const weaponRefs = []; // [{ root, info, targetable: THREE.Object3D }]

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

  // Gentle idle bob for the aircraft canopy/nose to give some life.
  if (aircraftGroup.children.length) {
    aircraftGroup.rotation.y = Math.sin(performance.now() * 0.00005) * 0.005;
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
