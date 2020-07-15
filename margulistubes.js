import * as dat from './node_modules/dat.gui/build/dat.gui.module.js';
import * as THREE from './node_modules/three/build/three.module.js';
import { MapControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';

let generators = {};
let params = new Params();
updateParams();

function Params() {
  this.margulis = 0.774426607009985;
  this.xMargRad = 0.262655660105195;
  this.yMargRad = 0.262655660105195;
  this.orthoAngle = 1.810246162850034;
  this.xAngle = -2.495370455560468;
  this.yAngle = -2.495370455560469;
  this.xWords = [];
  this.xInputWord = "";
  this.yWords = [];
  this.yInputWord = "";
  this.isRendering = false;
  this.needsUpdate = true;
}

function updateParams() {
  let p = params;

  p.orthoDist = p.xMargRad + p.yMargRad;
 
  p.coshmu = math.cosh( p.margulis );
  p.sinhdx = math.sinh( p.xMargRad );
  p.sinhdy = math.sinh( p.yMargRad );
  p.cosf = math.cos( p.orthoAngle );
  p.sintx2 = math.sin( p.xAngle / 2 ); 
  p.sinty2 = math.sin( p.yAngle / 2 ); 

  p.sinhsdx = p.sinhdx * p.sinhdx;
  p.coshsdx = 1 + p.sinhsdx;
  p.sinhsdy = p.sinhdy * p.sinhdy;
  p.coshsdy = 1 + p.sinhsdy;

  p.costx = 1 - (p.sintx2 * p.sintx2) * 2;
  p.costy = 1 - (p.sinty2 * p.sinty2) * 2;

  p.coshlx = (p.coshmu + p.costx * p.sinhsdx) / p.coshsdx;
  p.coshly = (p.coshmu + p.costy * p.sinhsdy) / p.coshsdy;
  
  p.xLength = math.acosh( p.coshlx );
  p.yLength = math.acosh( p.coshly );

  // Setting for generators
  p.coshlx2 = math.sqrt( (p.coshlx + 1) / 2 ); 
  p.sinhlx2 = math.sqrt( (p.coshlx - 1) / 2 ); 
  p.coshly2 = math.sqrt( (p.coshly + 1) / 2 ); 
  p.sinhly2 = math.sqrt( (p.coshly - 1) / 2 ); 

  p.costx2 = math.sqrt( 1 - p.sintx2 * p.sintx2 ); 
  p.costy2 = math.sqrt( 1 - p.sinty2 * p.sinty2 ); 

  p.coshLx2 = math.complex( p.coshlx2 * p.costx2, p.sinhlx2 * p.sintx2 ); 
  p.sinhLx2 = math.complex( p.sinhlx2 * p.costx2, p.coshlx2 * p.sintx2 ); 
  p.coshLy2 = math.complex( p.coshly2 * p.costy2, p.sinhly2 * p.sinty2 ); 
  p.sinhLy2 = math.complex( p.sinhly2 * p.costy2, p.coshly2 * p.sinty2 ); 

  p.coshdx = math.sqrt(p.coshsdx);
  p.coshdy = math.sqrt(p.coshsdy);

  p.expdx = p.coshdx + p.sinhdx; 
  p.expmdx = p.coshdx - p.sinhdx;
  p.expdy = p.coshdy + p.sinhdy; 
  p.expmdy = p.coshdy - p.sinhdy;

  p.sinf = math.sqrt( 1 - p.cosf * p.cosf );

  p.expif  = math.complex( p.cosf,  p.sinf );
  p.expmif = math.complex( p.cosf, -p.sinf );

  // These are usef for fixed points, so we make them complex
  p.expdx = math.complex(p.expdx, 0);
  p.expmdx = math.complex(p.expmdx, 0);
  p.expdyf = math.multiply(p.expdy, p.expif);
  p.expmdyf = math.multiply(p.expmdy, p.expmif);

  p.xAxis = {'m': params.expmdx.neg(), 'p': params.expmdx };
  p.yAxis = {'m': params.expdyf.neg(), 'p': params.expdyf };
  // End settings for generators

  updateGenerators();
}

function updateGenerators() {
  let p = params;

  generators.x = math.matrix(
    [[ p.coshLx2, math.multiply(p.expmdx, p.sinhLx2) ],
     [ math.multiply(p.expdx, p.sinhLx2), p.coshLx2]] );

  generators.y = math.matrix(
    [[ p.coshLy2, math.multiply(p.expdyf, p.sinhLy2)],
     [ math.multiply(p.expmdyf, p.sinhLy2), p.coshLy2]] );

  generators.X = SL2inverse( generators.x );
  generators.Y = SL2inverse( generators.y );
}

function SL2inverse( SL2mat ) {
  return math.matrix(
    [[ SL2mat.get([1,1])      ,  SL2mat.get([0,1]).neg() ],
     [ SL2mat.get([1,0]).neg(),  SL2mat.get([0,0])       ]] ); 
}

// Scene vars
let container, scene, camera, controls, renderer, xWordFolder, yWordFolder;

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
    var gui = new dat.GUI();
    gui.add(params, 'margulis', 0.0, 1.0).onChange(updateParamsAndScene).name("margulis");
    gui.add(params, 'xMargRad', 0.0, 5.0).onChange(updateParamsAndScene).name("x marg rad");
    gui.add(params, 'yMargRad', 0.0, 5.0).onChange(updateParamsAndScene).name("y marg rad");
    gui.add(params, 'orthoAngle', 0.0, math.pi).onChange(updateParamsAndScene).name("ortho angle");
    gui.add(params, 'xAngle', -math.pi, math.pi).onChange(updateParamsAndScene).name("x angle");
    gui.add(params, 'yAngle', -math.pi, math.pi).onChange(updateParamsAndScene).name("y angle");
    let derived = gui.addFolder('Derived Params');
    let xLenGUI = derived.add(params, 'xLength').name("x length").listen();
    let yLenGUI = derived.add(params, 'yLength').name("y length").listen();
    xLenGUI.domElement.style.pointerEvents = "none"
    yLenGUI.domElement.style.pointerEvents = "none"
    gui.add(params, 'xInputWord').onFinishChange(addTubeGUIX).name("Add x word").listen();
    gui.add(params, 'yInputWord').onFinishChange(addTubeGUIY).name("Add y word").listen();
    let wordsGUI = gui.addFolder('Current Words');
    xWordFolder = wordsGUI.addFolder('Words for axis(x)');
    yWordFolder = wordsGUI.addFolder('Words for axis(y)');
}    

let genInv = { 'x': 'X', 'X': 'x', 'y': 'Y', 'Y': 'y' };

function replaceTubes( maxDepth ) {
  let words = { 1: ["x","X","y","Y"] };
  let allWords = words[1];
  for (let depth = 1; depth < maxDepth; depth++) {
    let newWords = [];
    for (let word of words[depth]) {
      for (let gen of "xXyY") {
        if (genInv[gen] != word.charAt(0)) {
          newWords.push( gen + word );
        } 
      }
    }
    words[depth+1] = newWords;
    allWords = allWords.concat(newWords);
  }

  params.xWords = [];
  params.yWords = [""];
  for (let word of allWords) {
    params.xWords.push(word);
    params.yWords.push(word);
    let last = word.slice(-1);
    if (last == "x" || last == "X") {
      params.xWords.pop();
    }
    if (last == "y" || last == "Y") {
      params.yWords.pop();
    }
  }
}

function initTubes() {
  lineMaterial = new THREE.LineBasicMaterial( { color : 0x000000, linewidth: 2 } );

  for (let i = 1; i < MAX_POINTS; i++) {
    samplingValues[i] = samplingValues[i-1] + ANGLE_INC;
  }

  replaceTubes( 5 );
  
  for (let word of params.yWords) {
    addTubeToScene( word, 'yAxis', 'yMargRad', yWordFolder );
  }
  for (let word of params.xWords) {
    addTubeToScene( word, 'xAxis', 'xMargRad', xWordFolder );
  }
}

function addTubeGUIX() {
  if (params.xInputWord.match("[xXyY]+[yY]+") &&
     !params.xWords.includes(params.xInputWord)) {
    addTubeToScene( params.xInputWord, 'xAxis', 'xMargRad', xWordFolder );
    params.xInputWord = "";
    updateScene();
  }
}

function addTubeGUIY() {
  if (params.yInputWord.match("[xXyY]+[xX]+") &&
     !params.yWords.includes(params.yInputWord)) {
    addTubeToScene( params.yInputWord, 'yAxis', 'yMargRad', yWordFolder );
    params.yInputWord = "";
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

function getSinhOrthoX( a ) {
  // Takes an axis and returns ortho to axis(x)
  // Note: axis(x) = (-params.expmdx, paramx.expmdx)
  // CrossRatio is used to get cosh^2(orth/2), then cosh(ortho) = 2 cosh^2(othro/2) - 1
  let p = params;
  let coshOrtho = math.divide( math.subtract(
                    math.prod(p.expdx, a.m, a.p), params.expmdx),
                    math.subtract(a.m, a.p));
  let sinhOrtho =  math.sqrt( math.subtract( math.square(coshOrtho), 1) );
  if (math.abs( math.add( coshOrtho, sinhOrtho ) ) < 1 ) {
    sinhOrtho = sinhOrtho.neg();
  } 
  return sinhOrtho;
}

function getOrthoDisplacementX( a ) {
  // Takes an axis and returns ortho to axis(x)
  let p = params;
  let zm = math.multiply( a.m, p.expdx );
  let zp = math.multiply( a.p, p.expdx );
  let wm = math.divide( math.add( zm, 1 ), math.subtract( zm, 1 ) );
  let wp = math.divide( math.add( zp, 1 ), math.subtract( zp, 1 ) );
  let r = math.sqrt( math.multiply( wm, wp ) );
  // we need to choose the correct imaginary part for r.
  let sgn = ( wm.re * wp.im - wm.im * wp.re ) / ( r.re * (wp.im - wm.im) + r.im * (wm.re - wp.re) ); 
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
  sinhOrtho = getSinhOrthoX( wAxis );
  disp = getOrthoDisplacementX( wAxis );

  if (math.abs(disp.re) > 2 || math.abs(sinhOrtho) > 4) {
    tube.line.visible = false;
  } else {
    tube.line.visible = true;
    positions = tube.line.geometry.attributes.position.array;
    for (let i = 0; i < MAX_POINTS; i++) {
      // from Tubes in Hyperbolic 3-Manifolds by Przeworski
      // len_coord/cosh(view_tube_rad) + i girth_coord/sinh(view_tube_rad) =
      //    arcsinh( cosh(other_tube_rad + i t) / sinh(complex_ortho) );
      z = math.complex( radius, samplingValues[i] );
      s = math.asinh( math.divide( math.cosh(z), sinhOrtho) );
      positions[3 * i] = (s.im + disp.im) * params.sinhdx;
      positions[3 * i + 1] = (s.re + disp.re) * params.coshdx;
      positions[3 * i + 2] = 0;
    }
    tube.line.geometry.attributes.position.needsUpdate = true;   
  }
}


function addTubeToScene( word, axis_key, rad_key, wordFolder ) {
  let geometry = tubeGeometry();
  let line = new THREE.LineLoop( geometry, lineMaterial );
  let tube = { 'axis_key': axis_key, 'word': word, 'line': line, 'rad_key': rad_key };
  tubes.push( tube );
  updateTube( tube );
  scene.add( line );
  let wordGUI = wordFolder.add(tube, 'word');
  wordGUI.domElement.style.pointerEvents = "none"
}
