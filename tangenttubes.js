import * as dat from './node_modules/dat.gui/build/dat.gui.module.js';
import * as THREE from './node_modules/three/build/three.module.js';
import { MapControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';

let generators = {};
let params = new Params();
updateParams();

function Params() {
  this.fLength = 0.8314429;
  this.fAngle = -1.9455307;
  this.orthoDist = 0.8314429;
  this.orthoAngle = -1.9455307;
  this.orthoShift = 0.0001;
  this.orthoSpin = 0.0001;
  this.isRendering = false;
  this.needsUpdate = true;
  this.words = [];
  this.inputWord = "";
}

function updateParams() {
  let p = params;

  p.tubeRad = p.orthoDist / 2;
  p.sinhRad = math.sinh( p.tubeRad ) 
  p.coshRad = math.cosh( p.tubeRad ) 
 
  p.L = math.complex( p.fLength, p.fAngle );
  p.L2 = math.divide( p.L, 2 );
  p.D = math.complex( p.orthoDist, p.orthoAngle );
  p.D2 = math.divide( p.D, 2 );
  p.R = math.complex( p.orthoShift, p.orthoSpin );
  p.R2 = math.divide( p.R, 2 );

  p.coshD2 = math.cosh( p.D2 );
  p.sinhD2 = math.sinh( p.D2 );

  p.expL2 = math.exp( p.L2 ); 
  p.expmL2 = math.exp( p.L2.neg() );
  
  p.expR = math.exp( p.R );
  p.expR2 = math.exp( p.R2 ); 
  p.expmR2 = math.exp( p.R2.neg() ); 

  p.WfwAxis = {'m': math.multiply( p.expR, math.tanh( p.D2 ) ),
               'p': math.multiply( p.expR, math.coth( p.D2 ) )};

  updateGenerators();
}

function updateGenerators() {
  let p = params;

  generators.f = math.matrix(
    [[ p.expL2, math.complex( 0, 0 )  ],
     [ math.complex( 0, 0 ), p.expmL2 ]] );

  generators.W = math.matrix(
    [[ math.multiply( p.expR2,  p.coshD2 ),  math.multiply( p.expR2,  p.sinhD2 )],
     [ math.multiply( p.expmR2, p.sinhD2 ), math.multiply( p.expmR2, p.coshD2 )]] );

  generators.F = SL2inverse( generators.f );
  generators.w = SL2inverse( generators.W );
}

function SL2inverse( SL2mat ) {
  return math.matrix(
    [[ SL2mat.get([1,1])      ,  SL2mat.get([0,1]).neg() ],
     [ SL2mat.get([1,0]).neg(),  SL2mat.get([0,0])       ]] ); 
}

// Scene vars
let container, scene, camera, controls, renderer, wordListGUI;

// Tube drawing vars
let tubes = [];
let lineMaterial;
const MAX_POINTS = 120;
const ANGLE_INC = math.tau / MAX_POINTS;
let samplingValues = new Float64Array( MAX_POINTS ) ;

function render() {
  controls.update();
  renderer.render( scene, camera );
  params.isRendering = false;
}

function updateScene() {
  if (!params.isRendering) {
    params.isRendering = true;
    if (params.needsUpdate) {
      updateParams();
      tubes.forEach(updateTube);
      params.needsUpdate = false;
    }
    requestAnimationFrame( render );
  }
}

function updateParamsAndScene() {
  params.needsUpdate = true;
  updateScene();
}

initScene();
window.addEventListener('load', function() {
  initTubes();
  updateScene();
});

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
  // controls.enableDamping = true;
  controls.screenSpacePanning = true;
  controls.addEventListener('change', updateScene);

  window.onload = function() {
    initGUI();
  }
}

function initGUI() {
    let gui = new dat.GUI();
    gui.add(params, 'fLength', 0.0, 1.0).onChange(updateParamsAndScene).name("re length(g)");
    gui.add(params, 'fAngle', -math.pi, math.pi).onChange(updateParamsAndScene).name("im lengt(g)");
    gui.add(params, 'orthoDist', 0.0, 5.0).onChange(updateParamsAndScene).name("twice tube rad");
    gui.add(params, 'orthoAngle', -math.pi, math.pi).onChange(updateParamsAndScene).name("ortho angle");
    gui.add(params, 'orthoShift', 0.0, 1.0).onChange(updateParamsAndScene).name("ortho shift");
    gui.add(params, 'orthoSpin', -math.pi, math.pi).onChange(updateParamsAndScene).name("ortho spin");
    let derived = gui.addFolder('Derived Params');
    let tubeRadGUI = derived.add(params, 'tubeRad').name("Tube Radius").listen();
    tubeRadGUI.domElement.style.pointerEvents = "none"
    gui.add(params, 'inputWord').onFinishChange(addTubeGUI).name("Add Word").listen();
    wordListGUI = gui.addFolder('Current Words applied to T tube');
}    

let genInv = { 'f': 'F', 'F': 'f', 'w': 'W', 'W': 'w' };

function replaceTubes( maxDepth ) {
  let words = { 1: ["f", "F", "W", "ww"] };
  params.words = [""].concat(words[1]);
  for (let depth = 1; depth < maxDepth; depth++) {
    let newWords = [];
    for (let word of words[depth]) {
      for (let gen of "fFwW") {
        if (genInv[gen] != word.charAt(0)) {
          newWords.push( gen + word );
        } 
      }
    }
    words[depth+1] = newWords;
    params.words = params.words.concat(newWords);
  }
}

function initTubes() {
  lineMaterial = new THREE.LineBasicMaterial( { color : 0x000000, linewidth: 2 } );

  for (let i = 1; i < MAX_POINTS; i++) {
    samplingValues[i] = samplingValues[i-1] + ANGLE_INC;
  }

  replaceTubes( 1 );
 
  for (let word of params.words) {
    addTubeToScene( word, 'WfwAxis', 'tubeRad' );
  }
}

function addTubeGUI() {
  if (params.inputWord.matches("[fFwW]+") &&
     !params.words.includes(params.inputWord)) {
    addTubeToScene( params.inputWord, 'wfWAxis', 'tubeRad' );
    params.inputWord = "";
    updateScene();
  }
}

function getSL2( word ) {
  let one  = math.complex(1, 0);
  let zero = math.complex(0, 0);
  let w = math.matrix([[one, zero], [zero, one]]);
  for (let c of word) {
    w = math.multiply(w, generators[c]);
  }
  return w;
}

function mobius( w, z ) {
  let a = w.get([0,0]);
  let b = w.get([0,1]);
  let c = w.get([1,0]);
  let d = w.get([1,1]);
  // sigh for no overloading...
  return math.divide( math.add(math.multiply(a, z), b), math.add(math.multiply(c, z), d) );
}

function getSinhOrthoF( a ) {
  // Takes an axis and returns ortho to axis(f)
  // Note: axis(xf = (0, inf)
  // CrossRatio is used to get cosh^2(orth/2), then cosh(ortho) = 2 cosh^2(othro/2) - 1
  let p = params;
  let coshOrtho = math.divide( math.add( a.p, a.m), math.subtract( a.p, a.m) )
  let sinhOrtho =  math.sqrt( math.subtract( math.square(coshOrtho), 1) );
  if (math.abs( math.add( coshOrtho, sinhOrtho ) ) < 1 ) {
    sinhOrtho = sinhOrtho.neg();
  } 
  return sinhOrtho;
}

function getOrthoDisplacementF( a ) {
  // Takes an axis and returns ortho to axis(x)
  let r = math.sqrt( math.multiply( a.m, a.p ) );
  // we need to choose the correct imaginary part for r.
  let sgn = ( a.m.re * a.p.im - a.m.im * a.p.re ) / ( r.re * (a.p.im - a.m.im) + r.im * (a.m.re - a.p.re) ); 
  if (sgn < 0) {
     r = r.neg();
  }
  return math.log(r); 
}

function tubeGeometry() {
  let geometry = new THREE.BufferGeometry();
  let positions = new Float32Array( MAX_POINTS * 3 ); 
  geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  return geometry;
}

function updateTube( tube ) {
  let axis, radius, disp, w, wAxis, sinhOrtho, positions, z, s;

  axis = params[tube.axis_key];
  radius = params[tube.rad_key];
  w = getSL2( tube.word ); // generators expected to be updated
  wAxis = {'m': mobius( w, axis.m ), 'p': mobius( w, axis.p )}
  sinhOrtho = getSinhOrthoF( wAxis );
  disp = getOrthoDisplacementF( wAxis );

  positions = tube.line.geometry.attributes.position.array;
  for (let i = 0; i < MAX_POINTS; i++) {
    // from Tubes in Hyperbolic 3-Manifolds by Przeworski
    // len_coord/cosh(view_tube_rad) + i girth_coord/sinh(view_tube_rad) =
    //    arcsinh( cosh(other_tube_rad + i t) / sinh(complex_ortho) );
    z = math.complex( radius, samplingValues[i] );
    s = math.asinh( math.divide( math.cosh(z), sinhOrtho) );
    positions[3 * i] = (s.im + disp.im) * params.sinhRad;
    positions[3 * i + 1] = (s.re + disp.re) * params.coshRad;
    positions[3 * i + 2] = 0;
  }
  tube.line.geometry.attributes.position.needsUpdate = true;   
}


function addTubeToScene( word, axis_key, rad_key ) {
  let geometry = tubeGeometry();
  let line = new THREE.LineLoop( geometry, lineMaterial );
  let tube = { 'axis_key': axis_key, 'word': word, 'line': line, 'rad_key': rad_key };
  tubes.push( tube );
  updateTube( tube );
  scene.add( line );
  let wordGUI = wordListGUI.add(tube, 'word').name("");
  wordGUI.domElement.style.pointerEvents = "none"
}
