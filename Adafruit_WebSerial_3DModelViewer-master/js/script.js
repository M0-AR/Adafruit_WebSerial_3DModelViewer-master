// let the editor know that `Chart` is defined by some code
// included in another file (in this case, `index.html`)
// Note: the code will still work without this line, but without it you
// will see an error in the editor
/* global THREE */
/* global TransformStream */
/* global TextEncoderStream */
/* global TextDecoderStream */
'use strict';

import * as THREE from 'three';
import {OBJLoader} from 'objloader';
import { STLLoader } from "stlloader";
import { VRMLLoader } from "vrmlloader";
import { OrbitControls } from "orbitcontrols";


let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;
let showCalibration = false;

let orientation = [0, 0, 0];
let quaternion = [1, 0, 0, 0];
let calibration = [0, 0, 0, 0];

const maxLogLength = 100;
const baudRates = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 500000, 1000000, 2000000];
const log = document.getElementById('log');
const butConnect = document.getElementById('butConnect');
const butClear = document.getElementById('butClear');
const baudRate = document.getElementById('baudRate');
const autoscroll = document.getElementById('autoscroll');
const showTimestamp = document.getElementById('showTimestamp');
const angleType = document.getElementById('angle_type');
const lightSS = document.getElementById('light');
const darkSS = document.getElementById('dark');
const darkMode = document.getElementById('darkmode');
const canvas = document.querySelector('#canvas');
const calContainer = document.getElementById('calibration');
const logContainer = document.getElementById("log-container");

fitToContainer(canvas);

function fitToContainer(canvas){
  // Make it visually fill the positioned parent
  canvas.style.width ='100%';
  canvas.style.height='100%';
  // ...then set the internal size to match
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

document.addEventListener('DOMContentLoaded', async () => {
  butConnect.addEventListener('click', clickConnect);
  butClear.addEventListener('click', clickClear);
  autoscroll.addEventListener('click', clickAutoscroll);
  showTimestamp.addEventListener('click', clickTimestamp);
  baudRate.addEventListener('change', changeBaudRate);
  angleType.addEventListener('change', changeAngleType);
  darkMode.addEventListener('click', clickDarkMode);

  if ('serial' in navigator) {
    const notSupported = document.getElementById('notSupported');
    notSupported.classList.add('hidden');
  }

  if (isWebGLAvailable()) {
    const webGLnotSupported = document.getElementById('webGLnotSupported');
    webGLnotSupported.classList.add('hidden');
  }

  initBaudRate();
  loadAllSettings();
  updateTheme();
  await finishDrawing();
  await render();
});

/**
 * @name connect
 * Opens a Web Serial connection to a micro:bit and sets up the input and
 * output stream.
 */
async function connect() {
  // - Request a port and open a connection.
  port = await navigator.serial.requestPort();
  // - Wait for the port to open.toggleUIConnected
  await port.open({ baudRate: baudRate.value });

  let decoder = new TextDecoderStream();
  inputDone = port.readable.pipeTo(decoder.writable);
  inputStream = decoder.readable
    .pipeThrough(new TransformStream(new LineBreakTransformer()));

  reader = inputStream.getReader();
  readLoop().catch(async function(error) {
    toggleUIConnected(false);
    await disconnect();
  });
}

/**
 * @name disconnect
 * Closes the Web Serial connection.
 */
async function disconnect() {
  if (reader) {
    await reader.cancel();
    await inputDone.catch(() => {});
    reader = null;
    inputDone = null;
  }

  if (outputStream) {
    await outputStream.getWriter().close();
    await outputDone;
    outputStream = null;
    outputDone = null;
  }

  await port.close();
  port = null;
  showCalibration = false;
}

/**
 * @name readLoop
 * Reads data from the input stream and displays it on screen.
 */
async function readLoop() {
  while (true) {
    const {value, done} = await reader.read();
    if (value) {
      let plotdata;
      if (value.substr(0, 12) == "Orientation:") {
        orientation = value.substr(12).trim().split(",").map(x=>+x);
      }
      if (value.substr(0, 11) == "Quaternion:") {
        quaternion = value.substr(11).trim().split(",").map(x=>+x);
      }
      if (value.substr(0, 12) == "Calibration:") {
        calibration = value.substr(12).trim().split(",").map(x=>+x);
        if (!showCalibration) {
          showCalibration = true;
          updateTheme();
        }
      }
    }
    if (done) {
      console.log('[readLoop] DONE', done);
      reader.releaseLock();
      break;
    }
  }
}

function logData(line) {
  // Update the Log
  if (showTimestamp.checked) {
    let d = new Date();
    let timestamp = d.getHours() + ":" + `${d.getMinutes()}`.padStart(2, 0) + ":" +
        `${d.getSeconds()}`.padStart(2, 0) + "." + `${d.getMilliseconds()}`.padStart(3, 0);
    log.innerHTML += '<span class="timestamp">' + timestamp + ' -> </span>';
    d = null;
  }
  log.innerHTML += line+ "<br>";

  // Remove old log content
  if (log.textContent.split("\n").length > maxLogLength + 1) {
    let logLines = log.innerHTML.replace(/(\n)/gm, "").split("<br>");
    log.innerHTML = logLines.splice(-maxLogLength).join("<br>\n");
  }

  if (autoscroll.checked) {
    log.scrollTop = log.scrollHeight
  }
}

/**
 * @name updateTheme
 * Sets the theme to  Adafruit (dark) mode. Can be refactored later for more themes
 */
function updateTheme() {
  // Disable all themes
  document
    .querySelectorAll('link[rel=stylesheet].alternate')
    .forEach((styleSheet) => {
      enableStyleSheet(styleSheet, false);
    });

  if (darkMode.checked) {
    enableStyleSheet(darkSS, true);
  } else {
    enableStyleSheet(lightSS, true);
  }

  if (showCalibration && !logContainer.classList.contains('show-calibration')) {
    logContainer.classList.add('show-calibration')
  } else if (!showCalibration && logContainer.classList.contains('show-calibration')) {
    logContainer.classList.remove('show-calibration')
  }
}

function enableStyleSheet(node, enabled) {
  node.disabled = !enabled;
}


/**
 * @name reset
 * Reset the Plotter, Log, and associated data
 */
async function reset() {
  // Clear the data
  log.innerHTML = "";
}

/**
 * @name clickConnect
 * Click handler for the connect/disconnect button.
 */
async function clickConnect() {
  if (port) {
    await disconnect();
    toggleUIConnected(false);
    return;
  }

  await connect();

  reset();

  toggleUIConnected(true);
}

/**
 * @name clickAutoscroll
 * Change handler for the Autoscroll checkbox.
 */
async function clickAutoscroll() {
  saveSetting('autoscroll', autoscroll.checked);
}

/**
 * @name clickTimestamp
 * Change handler for the Show Timestamp checkbox.
 */
async function clickTimestamp() {
  saveSetting('timestamp', showTimestamp.checked);
}

/**
 * @name changeBaudRate
 * Change handler for the Baud Rate selector.
 */
async function changeBaudRate() {
  saveSetting('baudrate', baudRate.value);
}


/**
 * @name changeAngleType
 * Change handler for the Baud Rate selector.
 */
async function changeAngleType() {
  saveSetting('angletype', angleType.value);
}

/**
 * @name clickDarkMode
 * Change handler for the Dark Mode checkbox.
 */
async function clickDarkMode() {
  updateTheme();
  saveSetting('darkmode', darkMode.checked);
}

/**
 * @name clickClear
 * Click handler for the clear button.
 */
async function clickClear() {
  reset();
}

async function finishDrawing() {
  return new Promise(requestAnimationFrame);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @name LineBreakTransformer
 * TransformStream to parse the stream into lines.
 */
class LineBreakTransformer {
  constructor() {
    // A container for holding stream data until a new line.
    this.container = '';
  }

  transform(chunk, controller) {
    this.container += chunk;
    const lines = this.container.split('\n');
    this.container = lines.pop();
    lines.forEach(line => {
      controller.enqueue(line)
      logData(line);
    });
  }

  flush(controller) {
    controller.enqueue(this.container);
  }
}

function convertJSON(chunk) {
  try {
    let jsonObj = JSON.parse(chunk);
    jsonObj._raw = chunk;
    return jsonObj;
  } catch (e) {
    return chunk;
  }
}

function toggleUIConnected(connected) {
  let lbl = 'Connect';
  if (connected) {
    lbl = 'Disconnect';
  }
  butConnect.textContent = lbl;
  updateTheme()
}

function initBaudRate() {
  for (let rate of baudRates) {
    var option = document.createElement("option");
    option.text = rate + " Baud";
    option.value = rate;
    baudRate.add(option);
  }
}

function loadAllSettings() {
  // Load all saved settings or defaults
  autoscroll.checked = loadSetting('autoscroll', true);
  showTimestamp.checked = loadSetting('timestamp', false);
  baudRate.value = loadSetting('baudrate', 9600);
  angleType.value = loadSetting('angletype', 'quaternion');
  darkMode.checked = loadSetting('darkmode', false);
}

function loadSetting(setting, defaultValue) {
  let value = JSON.parse(window.localStorage.getItem(setting));
  if (value == null) {
    return defaultValue;
  }

  return value;
}

let isWebGLAvailable = function() {
  try {
    var canvas = document.createElement( 'canvas' );
    return !! (window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}


function updateCalibration() {
  // Update the Calibration Container with the values from calibration
  const calMap = [
    {caption: "Uncalibrated",         color: "#CC0000"},
    {caption: "Partially Calibrated", color: "#FF6600"},
    {caption: "Mostly Calibrated",    color: "#FFCC00"},
    {caption: "Fully Calibrated",     color: "#009900"},
  ];
  const calLabels = [
    "System", "Gyro", "Accelerometer", "Magnetometer"
  ]

  calContainer.innerHTML = "";
  for (var i = 0; i < calibration.length; i++) {
    let calInfo = calMap[calibration[i]];
    let element = document.createElement("div");
    element.innerHTML = calLabels[i] + ": " + calInfo.caption;
    element.style = "color: " + calInfo.color;
    calContainer.appendChild(element);
  }
}

function saveSetting(setting, value) {
  window.localStorage.setItem(setting, JSON.stringify(value));
}

let bunny;

const renderer = new THREE.WebGLRenderer({canvas});

const camera = new THREE.PerspectiveCamera(45, canvas.width/canvas.height, 0.1, 100);
camera.position.set(0, 5, 30);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0); // Set target to the center of the scene (where the bunny is)
controls.update();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x444444);
{
  const skyColor = 0xB1E1FF;  // light blue
  const groundColor = 0x666666;  // black
  const intensity = 0.5;
  const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
  scene.add(light);
}

{
  const color = 0xFFFFFF;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(0, 10, 0);
  light.target.position.set(-5, 0, 0);
  scene.add(light);
  scene.add(light.target);
}

function makeCubeInvisible(parentObject) {
  parentObject.traverse((child) => {
    if (child.isMesh && child.name === "Cube") {
      child.visible = false;
    }
  });
}

{
  const objLoader = new OBJLoader();
  objLoader.load('assets/earth02.obj', (root) => {
    bunny = root;
    // Scale the object. The same value for x, y, and z will keep the proportions.
    // bunny.scale.set(0.2, 0.2, 0.2); // This scales the object to half its original size. // for u.obj
    // bunny.scale.set(0.5, 0.5, 0.5); // This scales the object to half its original size.
    bunny.scale.set(10, 10, 10); // This scales the object to half its original size.
    scene.add(root);

    // Call the function to make the cube invisible
    makeCubeInvisible(bunny);
  });
}

function resizeRendererToDisplaySize(renderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }
  return needResize;
}

{
  // Function to save orientation
  function saveOrientation() {
    const rotation = bunny.rotation;
    localStorage.setItem('orientation', JSON.stringify({x: rotation.x, y: rotation.y, z: rotation.z}));
  }

  // Function to load orientation
  function loadOrientation() {
    const savedRotation = JSON.parse(localStorage.getItem('orientation'));
    console.log("loadOrientation()")
    if (savedRotation) {
      savedRotation.y = savedRotation.y - 10
      console.log(saveOrientation)
      bunny.rotation.set(savedRotation.x, savedRotation.y, savedRotation.z);
    }
  }

  // Call loadOrientation when initializing your scene
  {
    // loadOrientation();
  }

  // ... rest of your code ...
  // When updating orientation (for example, in your render function)
  function updateOrientation(newOrientation) {
    // Apply new orientation to the bunny
    bunny.rotation.set(newOrientation.x, newOrientation.y, newOrientation.z);
    
    // Save the new orientation
    saveOrientation();
  }
}



// Define visited at the top level but don't initialize it yet.
let visited = null;

function placeMarker(geometry, radius= 2.5) {
// function placeMarker(geometry, radius= 2.49) {
  if (!visited) {
    visited = new Array(geometry.attributes.position.count).fill(false);
  }


  const yaw = THREE.MathUtils.degToRad(orientation[0]);
  console.log("yaw " + yaw)
  const pitch = THREE.MathUtils.degToRad(orientation[1]);
  console.log("pitch" + " " + pitch)
  // Not converting the z value to radians because the sensor is on top of the cystoscopy and should reflect the camera, not the cystoscopy.
  // const zValue = THREE.MathUtils.degToRad(orientation[2]);
  const zValue = orientation[2];
  console.log("zValue " + zValue)

  // Adjust initial angles to place the marker at the back center (0, 0)
  const adjustedPhi = yaw + Math.PI / 2; // Rotate 90 degrees around Y-axis to point to the back
  console.log("adjustedPhi " + adjustedPhi)

  // The value '1' below is to ensure the marker always starts at the initial position when the user starts the 3D visualization
  // The 0.09 is a constant to downscale the zValue, allowing the sensor to accurately reflect the camera movement.
  const adjustedTheta = Math.PI / 1 - (zValue*0.09); // Correct logic line to adjust the polar angle appropriately
  // const adjustedTheta = Math.PI / 1 - pitch + (zValue * 0.09); // If pitch (Y-axis) is activated, the marker will move exactly like the sensor, which is incorrect. We want the marker to move in the opposite direction of the sensor.
  console.log("adjustedTheta " + adjustedTheta)

  
  // Convert to Cartesian coordinates (x, y, z) on the sphere's surface
  const x = radius * Math.sin(adjustedTheta) * Math.cos(adjustedPhi);
  const y = radius * Math.sin(adjustedTheta) * Math.sin(adjustedPhi);
  const z = radius * Math.cos(adjustedTheta);

  console.log("Marker position:", { x, y, z });

  const markerPosition = new THREE.Vector3(x, y, z);

  const markerPosition = new THREE.Vector3(x, y, z);

  const vertices = geometry.attributes.position.array;
  const colors = geometry.attributes.color.array;

  // Assuming 'geometry' has vertices that represent points on the sphere's surface
  for (let i = 0; i < vertices.length; i += 3) {
    const vertex = new THREE.Vector3(
        vertices[i],
        vertices[i + 1],
        vertices[i + 2]
    );

    // Check if this vertex is close enough to the marker position
    if (vertex.distanceTo(markerPosition) < 1.52) {
        visited[i / 3] = true;
        // Set a different color for vertices on the other half
        colors[i] = 1; // Red
        colors[i + 1] = 0; // Green
        colors[i + 2] = 0; // Blue
    } else if (visited[i / 3]) {
        if (vertices[i+2] >= 0) {
          // Reset the color for this vertex
          colors[i] = 0.2;
          colors[i + 1] = 1;
          colors[i + 2] = 0.2;
        } else {
          // Reset the color for this vertex
          colors[i] = 0.2;
          colors[i + 1] = 0.2;
          colors[i + 2] = 1;
        }
    }
  }

  geometry.attributes.color.needsUpdate = true;
}

async function render() {
  controls.update();

  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  if (bunny) {
    const targetGeometry = bunny.children[1].geometry; // Ensure this targets the right mesh

    if (!targetGeometry.attributes.color) {
      const vertexColors = new Float32Array(
        targetGeometry.attributes.position.count * 3
      ).fill(1);
      targetGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(vertexColors, 3)
      );
    }

    if (angleType.value === "euler") {
      const rotationEuler = showCalibration
        ? new THREE.Euler(
            THREE.MathUtils.degToRad(360 - orientation[2]),
            THREE.MathUtils.degToRad(orientation[0]),
            THREE.MathUtils.degToRad(orientation[1]),
            "YZX"
          )
        : new THREE.Euler(
            THREE.MathUtils.degToRad(orientation[2]),
            THREE.MathUtils.degToRad(orientation[0] - 180),
            THREE.MathUtils.degToRad(-orientation[1]),
            "YZX"
          );
      // bunny.setRotationFromEuler(rotationEuler);
    } else {
      const rotationQuaternion = new THREE.Quaternion(
        quaternion[1],
        quaternion[3],
        -quaternion[2],
        quaternion[0]
      );
      // bunny.setRotationFromQuaternion(rotationQuaternion);
    }

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      wireframe: true, // Added wireframe property here
      transparent: true,
      opacity: 0.1,
    });

    bunny.children[1].material = material;

    placeMarker(targetGeometry);
  }
  renderer.render(scene, camera);
  updateCalibration();
  await sleep(10);
  await finishDrawing();
  await render();
}


function createTextCanvas(text, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  // context.fillStyle = "rgb(100, 100, 100)";
  context.fillStyle = "white";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "15px Arial";
  context.fillText(text, width / 2, height / 2);
  return canvas;
}

// function addDirectionLabel(direction, position) {
//   const canvas = createTextCanvas(direction, 100, 30);
//   const texture = new THREE.CanvasTexture(canvas);
//   const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
//   const sprite = new THREE.Sprite(spriteMaterial);
//   sprite.position.copy(position);
//   sprite.scale.set(5, 1.5, 1);
//   scene.add(sprite);
// }

function addDirectionLabel(direction, position) {
  // Split the direction text into lines
  const lines = direction.split('\n');
  
  // Create separate canvases for each line of text
  const canvases = lines.map(line => createTextCanvas(line, 100, 30));
  
  // Calculate the total height of all canvases
  const totalHeight = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
  
  // Create a container canvas to hold all lines
  const containerCanvas = document.createElement("canvas");
  containerCanvas.width = 100;
  containerCanvas.height = totalHeight;
  const context = containerCanvas.getContext("2d");
  
  // Fill the container canvas with individual canvases
  let yOffset = 0;
  canvases.forEach(canvas => {
    context.drawImage(canvas, 0, yOffset);
    yOffset += canvas.height;
  });

  // Create a texture from the container canvas
  const texture = new THREE.CanvasTexture(containerCanvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.copy(position);
  sprite.scale.set(4, 2, 1);
  scene.add(sprite);
}

// Add labels for directions
addDirectionLabel("UP", new THREE.Vector3(0, 10, 0));
addDirectionLabel("DOWN", new THREE.Vector3(0, -10, 0));
addDirectionLabel("RIGHT", new THREE.Vector3(-10, 0, 0));
addDirectionLabel("LEFT", new THREE.Vector3(10, 0, 0));
addDirectionLabel("FRONT", new THREE.Vector3(0, 0, 10));
addDirectionLabel("BACK\nSTART HERE", new THREE.Vector3(0, 0, -10));
