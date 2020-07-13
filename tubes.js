import * as dat from './node_modules/dat.gui/build/dat.gui.module.js';
import * as THREE from './node_modules/three/build/three.module.js';
import { MapControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';

let settings = new Settings();
function Settings() {
  this.fixedTubeRad = 0.5;
  this.otherTubeRad = 0.6;
  this.orthoDist = 1.1;
  this.orthoAngle = 0.4 * math.pi; 
  this.needsUpdate = false;
}

// Scene vars
let container, scene, camera, controls, renderer;

// Tube drawing cars
let tubes = [];
let lineMaterial;
const MAX_POINTS = 120;
const ANGLE_INC = 2 * math.pi / MAX_POINTS;
let samplingValues = new Float64Array( MAX_POINTS ) ;
let sinhFixed = math.sinh( settings.fixedTubeRad );
let coshFixed = math.cosh( settings.fixedTubeRad );

function animate() {
  requestAnimationFrame( animate );
  controls.update();

  if (settings.needsUpdate) {
    tubes.forEach(updateTube);
    settings.needsUpdate = false;
  }  

  renderer.render( scene, camera );
}

initScene();
initTubes();
// console.log(scene);
animate();

function initScene() {
    container = document.createElement( 'div' );
    document.body.appendChild( container );

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xffffff );

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 500 );
    camera.position.set( 0, 0, 5 );
    camera.lookAt( 0, 0, 0 );
    scene.add(camera);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setPixelRatio( window.devicePixelRatio );
    container.appendChild( renderer.domElement );

    controls = new MapControls( camera, renderer.domElement );
    controls.screenSpacePanning = true;
 
    window.onload = function() {
	    initGUI();
    }
}

function initGUI() {
    var gui = new dat.GUI();
    gui.add(settings,'fixedTubeRad',0.0,4.0).onChange(function(x) {
      sinhFixed = math.sinh( settings.fixedTubeRad );
      coshFixed = math.cosh( settings.fixedTubeRad );
      settings.needsUpdate = true;
    }).name("Fixed Radius");
    gui.add(settings,'otherTubeRad',0.0,4.0).onChange(function(x) {
      settings.needsUpdate = true;
    }).name("Other Radius");
    gui.add(settings,'orthoDist',0.0,4.0).onChange(function(x) {
      settings.needsUpdate = true; 
    }).name("Orthodistance");
    gui.add(settings,'orthoAngle',-1.57,1.57).onChange(function(x) {
      settings.needsUpdate = true;
    }).name("Orthoangle");
}    

function initTubes() {

  lineMaterial = new THREE.LineBasicMaterial( { color : 0x000000, linewidth: 2 } );

  for (let i = 1; i < MAX_POINTS; i++) {
    samplingValues[i] = samplingValues[i-1] + ANGLE_INC;
  }

  addTubeToScene( math.complex(settings.orthoDist, settings.orthoAngle) );
}

function tubeGeometry() {
  let geometry = new THREE.BufferGeometry();
  let positions = new Float32Array( MAX_POINTS * 3 ); 
  geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  return geometry;
}

function updateTube(tube) {
  // console.log("Updateing a tube");
  // console.log(tube);
  let t, z, s, sinhOrtho, positions;
  tube.radius = settings.otherTubeRad; // fix this one tubes are assocaited to words
  tube.ortho = math.complex(settings.orthoDist, settings.orthoAngle);
  sinhOrtho = math.sinh( tube.ortho );
  positions = tube.line.geometry.attributes.position.array;
  for (let i = 0; i < MAX_POINTS; i++) {
    t = samplingValues[i];
    z = math.complex( tube.radius, t );
    s = math.asinh( math.cosh(z).div(sinhOrtho) );      
    positions[3 * i] = s.im * sinhFixed;
    positions[3 * i + 1] = s.re * coshFixed;
    positions[3 * i + 2] = 0;
  } 
  tube.line.geometry.attributes.position.needsUpdate = true;   
  // tube.line.geometry.computeBoundingSphere();
}


function addTubeToScene(ortho) {
  let geometry = tubeGeometry();
  let line = new THREE.LineLoop( geometry, lineMaterial );
  let tube = { 'ortho': ortho, 'line': line, 'radius': settings.otherTubeRad };
  tubes.push( tube );
  updateTube( tube );
  scene.add( line );
}
