// ---- helpers (ported from the original repo) ----
const round = (v, p = 3) => parseFloat(v.toFixed(p));
const clamp = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const adjust = (v, fromMin, fromMax, toMin, toMax) =>
  round(toMin + ((toMax - toMin) * (v - fromMin)) / (fromMax - fromMin));

// ---- all selectable holographic effects ----
// each sets data-attributes that match the CSS selectors
const EFFECTS = [
  { label: "None (plain card)",        rarity: "",                  supertype: "pokémon" },
  { label: "Reverse Holo",             rarity: "reverse holo",      supertype: "pokémon" },
  { label: "Rare Holo",                rarity: "rare holo",         supertype: "pokémon" },
  { label: "Holo Cosmos (galaxy)",     rarity: "rare holo cosmos",  supertype: "pokémon" },
  { label: "Amazing Rare",             rarity: "amazing rare",      supertype: "pokémon" },
  { label: "Radiant Rare",             rarity: "radiant rare",      supertype: "pokémon" },
  { label: "V (regular)",              rarity: "rare holo v",       supertype: "pokémon" },
  { label: "V / VMAX Full Art (Ultra)",rarity: "rare ultra",        supertype: "pokémon" },
  { label: "Shiny Rare",               rarity: "rare shiny",        supertype: "pokémon" },
  { label: "Secret Rare (Gold)",       rarity: "rare secret",       supertype: "pokémon" },
  { label: "Rainbow Rare (Secret)",    rarity: "rare rainbow",      supertype: "pokémon" },
];

const card = document.querySelector(".card");
const rotator = card.querySelector(".card__rotator");
const select = document.getElementById("effect");

// ---- populate the dropdown (default browser styling) ----
EFFECTS.forEach((fx, i) => {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = fx.label;
  select.appendChild(opt);
});

function applyEffect(i) {
  const fx = EFFECTS[i];
  if (fx.rarity) card.setAttribute("data-rarity", fx.rarity);
  else card.removeAttribute("data-rarity");
  card.setAttribute("data-supertype", fx.supertype);
  card.setAttribute("data-subtypes", "basic");
}

// start on "V (regular)" — a nice default for Ralts
const START = 6;
select.value = String(START);
applyEffect(START);

select.addEventListener("change", (e) => applyEffect(Number(e.target.value)));

// ---- pointer interaction with spring-like smoothing ----
const target = { px: 50, py: 50, gx: 50, gy: 50, bx: 50, by: 50, rx: 0, ry: 0, o: 0 };
const current = { ...target };
let rafId = null;

function setVars() {
  const fromCenter = clamp(
    Math.sqrt((current.gy - 50) ** 2 + (current.gx - 50) ** 2) / 50, 0, 1
  );
  const s = card.style;
  s.setProperty("--pointer-x", `${current.gx}%`);
  s.setProperty("--pointer-y", `${current.gy}%`);
  s.setProperty("--pointer-from-center", fromCenter);
  s.setProperty("--pointer-from-top", current.gy / 100);
  s.setProperty("--pointer-from-left", current.gx / 100);
  s.setProperty("--card-opacity", current.o);
  s.setProperty("--rotate-x", `${current.rx}deg`);
  s.setProperty("--rotate-y", `${current.ry}deg`);
  s.setProperty("--background-x", `${current.bx}%`);
  s.setProperty("--background-y", `${current.by}%`);
}

function animate() {
  let moving = false;
  const ease = 0.12;
  for (const k of Object.keys(target)) {
    const diff = target[k] - current[k];
    if (Math.abs(diff) > 0.01) {
      current[k] += diff * ease;
      moving = true;
    } else {
      current[k] = target[k];
    }
  }
  setVars();
  if (moving) {
    rafId = requestAnimationFrame(animate);
  } else {
    rafId = null;
  }
}

function kick() {
  if (rafId === null) rafId = requestAnimationFrame(animate);
}

function interact(e) {
  const rect = rotator.getBoundingClientRect();
  const point = e.touches ? e.touches[0] : e;
  const absolute = { x: point.clientX - rect.left, y: point.clientY - rect.top };
  const percent = {
    x: clamp(round((100 / rect.width) * absolute.x)),
    y: clamp(round((100 / rect.height) * absolute.y)),
  };
  const center = { x: percent.x - 50, y: percent.y - 50 };

  target.bx = adjust(percent.x, 0, 100, 37, 63);
  target.by = adjust(percent.y, 0, 100, 33, 67);
  target.rx = round(-(center.x / 3.5));
  target.ry = round(center.y / 3.5);
  target.gx = round(percent.x);
  target.gy = round(percent.y);
  target.o = 1;

  card.classList.add("interacting");
  kick();
}

function interactEnd() {
  target.rx = 0;
  target.ry = 0;
  target.gx = 50;
  target.gy = 50;
  target.bx = 50;
  target.by = 50;
  target.o = 0;
  card.classList.remove("interacting");
  kick();
}

rotator.addEventListener("pointermove", interact);
rotator.addEventListener("pointerleave", interactEnd);
rotator.addEventListener("touchmove", (e) => { e.preventDefault(); interact(e); }, { passive: false });
rotator.addEventListener("touchend", interactEnd);

// ---- gyroscope / device tilt ----
const gyroBtn = document.getElementById("gyro");
const LIMIT = { x: 16, y: 18 }; // gamma (left/right), beta (front/back)
let baseline = null; // captured on first reading so "flat" = resting pose

function orientate(e) {
  const gamma = e.gamma ?? 0; // left/right tilt
  const beta = e.beta ?? 0;   // front/back tilt
  if (baseline === null) baseline = { gamma, beta };

  const degrees = {
    x: clamp(gamma - baseline.gamma, -LIMIT.x, LIMIT.x),
    y: clamp(beta - baseline.beta, -LIMIT.y, LIMIT.y),
  };

  target.bx = adjust(degrees.x, -LIMIT.x, LIMIT.x, 37, 63);
  target.by = adjust(degrees.y, -LIMIT.y, LIMIT.y, 33, 67);
  target.rx = round(degrees.x * -1);
  target.ry = round(degrees.y);
  target.gx = adjust(degrees.x, -LIMIT.x, LIMIT.x, 0, 100);
  target.gy = adjust(degrees.y, -LIMIT.y, LIMIT.y, 0, 100);
  target.o = 1;

  card.classList.add("interacting");
  kick();
}

function startGyro() {
  baseline = null; // recalibrate to current hold position
  window.addEventListener("deviceorientation", orientate);
  gyroBtn.textContent = "Recalibrate gyroscope";
}

// only show the button when the device actually reports orientation
if (window.DeviceOrientationEvent) {
  gyroBtn.hidden = false;
  gyroBtn.addEventListener("click", async () => {
    // iOS 13+ requires permission, requested from this user gesture
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") {
          gyroBtn.textContent = "Motion permission denied";
          return;
        }
      } catch (err) {
        gyroBtn.textContent = "Motion unavailable";
        return;
      }
    }
    startGyro();
  });
}
