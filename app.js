import {
  Scene,
  Color,
  Mesh,
  PerspectiveCamera,
  WebGLRenderer,
  Vector3,
  FileLoader,
  PointLight,
  PointLightHelper,
  ShaderMaterial,
  SphereBufferGeometry,
  UnsignedByteType,
  BoxBufferGeometry,
  UniformsUtils,
  CubeCamera,
  WebGLRenderTarget,
  BackSide,
  PlaneGeometry
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GUI } from "three/examples/jsm/libs/dat.gui.module.js";
//import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EquirectangularToCubeGenerator } from "three/examples/jsm/loaders/EquirectangularToCubeGenerator.js";
import { PMREMGenerator } from "three/examples/jsm/pmrem/PMREMGenerator.js";
import { PMREMCubeUVPacker } from "three/examples/jsm/pmrem/PMREMCubeUVPacker.js";

var container;
var camera, scene, renderer, controls, materialBallA, materialBallB;
var vShader, fPBR;
var vCubeMap, fHdrDecode, fIrradianceConvolute, fPrefilter, vPlane, fBRDF, fMultiScatterPBR;
var meshCube, meshBallA, meshBallB;
var envMap;
var cubeCamera, cubeCamera2;
var materialCube, materialBox, materialPrefilterBox;
var uniformsCube;
var meshBox;
var cubeCameraPrefilter0,
    cubeCameraPrefilter1,
    cubeCameraPrefilter2,
    cubeCameraPrefilter3,
    cubeCameraPrefilter4;
var meshPrefilterBox0,
    meshPrefilterBox1,
    meshPrefilterBox2,
    meshPrefilterBox3,
    meshPrefilterBox4;
var bufferScene, bufferTexture;
// initial parameters of material and light
var params = {
  metallic: 0.95,
  rough: 0.60
};
const lightStrength = 2.20;

var directionalLightDir = new Vector3(10.0, 0.0, 10.0);

function init() {

  container = document.createElement("div");
  document.body.appendChild(container);
  camera = new PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1,
    100000
  );
  camera.position.x = -7.836271605802701;
  camera.position.y = -0.20474179466840486;
  camera.position.z = 13.948151422952169;
  
  scene = new Scene();
  renderer = new WebGLRenderer();

  var gui = new GUI();
  gui.add(params, "metallic", 0, 1);
  gui.add(params, "rough", 0, 1);
  gui.open();

  // load separated shader files
  var loader = new FileLoader();
  var numFilesLeft = 9;
  // runMoreIfDone() is run every time there's one shader finishes loading
  function runMoreIfDone() {
    --numFilesLeft;
    if (numFilesLeft === 0) {
      more();// wait until all shaders finish loading
    }
  }
  // loader.load()'s second parameter is callback function
  loader.load("./shaders/vertex.vs", function(data) {
    vShader = data;
    runMoreIfDone();
  });

  loader.load("./shaders/PBR.frag", function(data) {
    fPBR = data;
    runMoreIfDone();
  });

  loader.load("./shaders/cubeMap.vs", function(data) {
    vCubeMap = data;
    runMoreIfDone();
  });
  
  loader.load("./shaders/hdrDecode.frag", function(data) {
    fHdrDecode = data;
    runMoreIfDone();
  });

  loader.load("./shaders/irradianceConvolute.frag", function(data) {
    fIrradianceConvolute = data;
    runMoreIfDone();
  });

  loader.load("./shaders/prefilter.frag", function(data) {
      fPrefilter = data;
      runMoreIfDone();
    });

  loader.load("./shaders/plane.vs", function(data) {
      vPlane = data;
      runMoreIfDone();
    });

  loader.load("./shaders/BRDF.frag", function(data) {
      fBRDF = data;
      runMoreIfDone();
    });  

  loader.load("./shaders/multiScatterPBR.frag", function(data) {
      fMultiScatterPBR = data;
      runMoreIfDone();
    });  
  
}

// more() is run after all shaders finishes loading
function more() {
  var light = new PointLight(0xffffff, 1, 100);// Deprecated!!!
  var sphereSize = 1;// Deprecated!!!
  var pointLightHelper = new PointLightHelper(light, sphereSize);// Deprecated!!!
  
  // load HDR map file, and transform it from equirectangular into cube map
  new RGBELoader()
    .setType(UnsignedByteType)
    //.setPath("three/examples/textures/equirectangular/")
    .load(
      "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/pedestrian_overpass_1k.hdr",
      function(texture) {
        var cubeGenerator = new EquirectangularToCubeGenerator(texture, {
          resolution: 1024
        });
        cubeGenerator.update(renderer);

        var pmremGenerator = new PMREMGenerator(
          cubeGenerator.renderTarget.texture
        );
        pmremGenerator.update(renderer);

        var pmremCubeUVPacker = new PMREMCubeUVPacker(pmremGenerator.cubeLods);
        pmremCubeUVPacker.update(renderer);

        envMap = pmremCubeUVPacker.CubeUVRenderTarget.texture;

        pmremGenerator.dispose();
        pmremCubeUVPacker.dispose();

        scene.background = cubeGenerator.renderTarget;
      }
    );

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.gammaOutput = true;
  container.appendChild(renderer.domElement);

  createControls();

  // HDR decoding for the environment map takes place here, named as "Cube"
  var geometryCube = new BoxBufferGeometry(10, 10, 10);
  var uniformsCubeOriginal = {
    "tCube": { value: null }
  };
  uniformsCube = UniformsUtils.clone(uniformsCubeOriginal);
  uniformsCube["tCube"].value = envMap;
  materialCube = new ShaderMaterial({
    uniforms: uniformsCube,
    vertexShader: vCubeMap,
    fragmentShader: fHdrDecode,
    side: BackSide
  });
  meshCube = new Mesh(geometryCube, materialCube);
  scene.add(meshCube);

  // the decoded evironment map is stored in the render target cube (cubeCamera.renderTarget.texture) for later use
  cubeCamera = new CubeCamera( 1, 100, 512 );
  scene.add( cubeCamera );

  // irradiance convolution takes place here, named as "Box"
  var geometryBox = new BoxBufferGeometry(10, 10, 10);
  var uniformsBoxOriginal = {
    "tCube": { value: null }
  };
  var uniformsBox = UniformsUtils.clone(uniformsBoxOriginal);
  uniformsBox["tCube"].value = cubeCamera.renderTarget.texture;
  materialBox = new ShaderMaterial({
    uniforms: uniformsBox, 
    vertexShader: vCubeMap,
    fragmentShader: fIrradianceConvolute,
    side: BackSide
  });
  meshBox = new Mesh(geometryBox, materialBox);
  meshBox.position.x += 10.0;
  
  // the result of irradiance convolution is stored in the render target cube
  cubeCamera2 = new CubeCamera( 1, 100, 32 );
  scene.add( cubeCamera2 );
  cubeCamera2.position.x += 10.0;

  // stores 5 render target cubes for respectively 5 roughness levels
  // for high roughnesses, low resolution can be adopted since here's little detail in the prefiltered result
  cubeCameraPrefilter0 = new CubeCamera( 1, 100, 128 );
  scene.add( cubeCameraPrefilter0 );
  cubeCameraPrefilter0.position.x += 20.0;

  cubeCameraPrefilter1 = new CubeCamera( 1, 100, 64 );
  scene.add( cubeCameraPrefilter1 );
  cubeCameraPrefilter1.position.x += 30.0;

  cubeCameraPrefilter2 = new CubeCamera( 1, 100, 32 );
  scene.add( cubeCameraPrefilter2 );
  cubeCameraPrefilter2.position.x += 40.0;

  cubeCameraPrefilter3 = new CubeCamera( 1, 100, 16 );
  scene.add( cubeCameraPrefilter3 );
  cubeCameraPrefilter3.position.x += 50.0;

  cubeCameraPrefilter4 = new CubeCamera( 1, 100, 8 );
  scene.add( cubeCameraPrefilter4 );
  cubeCameraPrefilter4.position.x += 60.0;

  // prefiltering takes place here, named as "PrefilterBox"
  var uniformsPrefilterBoxOriginal = {
    "tCube": { value: null },
    "roughness" : {value: 0.5}
  };
  var uniformsPrefilterBox = UniformsUtils.clone(uniformsPrefilterBoxOriginal);
  uniformsPrefilterBox["tCube"].value = cubeCamera.renderTarget.texture;
  materialPrefilterBox = new ShaderMaterial({
    uniforms: uniformsPrefilterBox, 
    vertexShader: vCubeMap,
    fragmentShader: fPrefilter,
    side: BackSide
  });
  meshPrefilterBox0 = new Mesh(geometryBox, materialPrefilterBox);
  meshPrefilterBox0.position.x += 20.0;
  meshPrefilterBox1 = new Mesh(geometryBox, materialPrefilterBox);
  meshPrefilterBox1.position.x += 30.0;
  meshPrefilterBox2 = new Mesh(geometryBox, materialPrefilterBox);
  meshPrefilterBox2.position.x += 40.0;
  meshPrefilterBox3 = new Mesh(geometryBox, materialPrefilterBox);
  meshPrefilterBox3.position.x += 50.0;
  meshPrefilterBox4 = new Mesh(geometryBox, materialPrefilterBox);
  meshPrefilterBox4.position.x += 60.0;

  bufferScene = new Scene();
  bufferTexture = new WebGLRenderTarget( 512, 512);

  // the 2D BRDF LUT in ambient specular lighting is precomputed on the plane
  var geometryBRDF = new PlaneGeometry(2, 2);
  var materialBRDF = new ShaderMaterial({
    vertexShader: vPlane,
    fragmentShader: fBRDF
  });
  var BRDF = new Mesh( geometryBRDF, materialBRDF );
  bufferScene.add( BRDF );

  // var geometryPlane = new PlaneGeometry( 10, 10 );
  // var uniformsPlaneOriginal = {
  //   "texture": { value: null }
  // };
  // var uniformsPlane = UniformsUtils.clone(uniformsPlaneOriginal);
  // uniformsPlane["texture"].value = bufferTexture.texture;
  // var materialPlane = new ShaderMaterial( {
  //   uniforms: uniformsPlane,
  //   vertexShader: vSimplePlane,
  //   fragmentShader: fSimplePlane
  // } );
  // var plane = new Mesh( geometryPlane, materialPlane );
  // scene.add( plane );
  // plane.position.x += 60;
  // plane.position.z += 60;

  // (Lower) Ball A for multiple scattering
  var uniformsBallOriginalA = {
    albedo: {
      type: "c",
      value: new Color(0xb87333)
    },
    metallic: { value: params.metallic }, 
    rough: { value: params.rough }, 
    directionalLightDir: { value: directionalLightDir },
    lightStrength: { value: lightStrength },
    "tCube": { value: null },
    "prefilterCube0": { value: null },
    "prefilterCube1": { value: null },
    "prefilterCube2": { value: null },
    "prefilterCube3": { value: null },
    "prefilterCube4": { value: null },
    "prefilterScale": { value: null },
    "BRDFlut": { value: null }
  };
  var uniformsBallA = UniformsUtils.clone(uniformsBallOriginalA);
  uniformsBallA["tCube"].value = cubeCamera2.renderTarget.texture;
  uniformsBallA["prefilterCube0"].value = cubeCameraPrefilter0.renderTarget.texture;
  uniformsBallA["prefilterCube1"].value = cubeCameraPrefilter1.renderTarget.texture;
  uniformsBallA["prefilterCube2"].value = cubeCameraPrefilter2.renderTarget.texture;
  uniformsBallA["prefilterCube3"].value = cubeCameraPrefilter3.renderTarget.texture;
  uniformsBallA["prefilterCube4"].value = cubeCameraPrefilter4.renderTarget.texture;
  uniformsBallA["prefilterScale"].value = 4.0 * params.rough;
  uniformsBallA["BRDFlut"].value = bufferTexture.texture;
  materialBallA = new ShaderMaterial({
    uniforms: uniformsBallA,
    vertexShader: vShader,
    fragmentShader: fMultiScatterPBR
  });
  var geometry = new SphereBufferGeometry(1, 32, 16);
  meshBallA = new Mesh(geometry, materialBallA);
  meshBallA.position.x = 0;
  meshBallA.position.y = -4;
  meshBallA.position.z = 0;
  meshBallA.scale.x = meshBallA.scale.y = meshBallA.scale.z = 3;

  // (Upper) Ball B for single scattering
  var uniformsBallOriginalB = {
    albedo: {
      type: "c",
      value: new Color(0xb87333)
    },
    metallic: { value: params.metallic }, 
    rough: { value: params.rough }, 
    directionalLightDir: { value: directionalLightDir },
    lightStrength: { value: lightStrength },
    "tCube": { value: null },
    "prefilterCube0": { value: null },
    "prefilterCube1": { value: null },
    "prefilterCube2": { value: null },
    "prefilterCube3": { value: null },
    "prefilterCube4": { value: null },
    "prefilterScale": { value: null },
    "BRDFlut": { value: null }
  };
  var uniformsBallB = UniformsUtils.clone(uniformsBallOriginalB);
  uniformsBallB["tCube"].value = cubeCamera2.renderTarget.texture;
  uniformsBallB["prefilterCube0"].value = cubeCameraPrefilter0.renderTarget.texture;
  uniformsBallB["prefilterCube1"].value = cubeCameraPrefilter1.renderTarget.texture;
  uniformsBallB["prefilterCube2"].value = cubeCameraPrefilter2.renderTarget.texture;
  uniformsBallB["prefilterCube3"].value = cubeCameraPrefilter3.renderTarget.texture;
  uniformsBallB["prefilterCube4"].value = cubeCameraPrefilter4.renderTarget.texture;
  uniformsBallB["prefilterScale"].value = 4.0 * params.rough;
  uniformsBallB["BRDFlut"].value = bufferTexture.texture;
  materialBallB = new ShaderMaterial({
    uniforms: uniformsBallB,
    vertexShader: vShader,
    fragmentShader: fPBR
  });
  meshBallB = new Mesh(geometry, materialBallB);
  meshBallB.position.x = 0;
  meshBallB.position.y = 4;
  meshBallB.position.z = 0;
  meshBallB.scale.x = meshBallB.scale.y = meshBallB.scale.z = 3;

  // "An"other box
  // var geometryAn = new BoxBufferGeometry(10, 10, 10);
  // var uniformsAnOriginal = {
  //   "tCube": { value: null }
  // };
  // var uniformsAn = UniformsUtils.clone(uniformsAnOriginal);
  // uniformsAn["tCube"].value = cubeCamera.renderTarget.texture;
  // materialAn = new ShaderMaterial({
  //   uniforms: uniformsAn, 
  //   vertexShader: vCubeMap,
  //   fragmentShader: fSimple
  // });
  //meshAn = new Mesh(geometryAn, materialAn);
  // meshAn.position.x -= 30.0;
  // meshAn.position.z -= 30.0;

  animate();
}

var flagEnvMap = true;
function render() {

  materialBallA.uniforms.metallic = { value: params.metallic };
  materialBallB.uniforms.metallic = { value: params.metallic };
  materialBallA.uniforms.rough = { value: params.rough };
  materialBallB.uniforms.rough = { value: params.rough };
  var prefilterScale = 4.0 * params.rough;
  materialBallA.uniforms.prefilterScale = { value: prefilterScale };
  materialBallB.uniforms.prefilterScale = { value: prefilterScale };

  // precomputation is in this IF block
  // the precomputation starts after the environment map is successfully loaded, and runs only once
  if(envMap && flagEnvMap){
    cubeCamera.update( renderer, scene );
    scene.remove(meshCube);// the cube/box meshes are discarded right after use, since they're only used in precomputation
    scene.add(meshBox);
    cubeCamera2.update( renderer, scene );
    scene.remove(meshBox);

    scene.add(meshPrefilterBox0);
    materialPrefilterBox.uniforms["roughness"].value = 0.025;
    cubeCameraPrefilter0.update( renderer, scene );
    scene.remove(meshPrefilterBox0);

    scene.add(meshPrefilterBox1);
    materialPrefilterBox.uniforms["roughness"].value = 0.25;
    cubeCameraPrefilter1.update( renderer, scene );
    scene.remove(meshPrefilterBox1);

    scene.add(meshPrefilterBox2);
    materialPrefilterBox.uniforms["roughness"].value = 0.5;
    cubeCameraPrefilter2.update( renderer, scene );
    scene.remove(meshPrefilterBox2);

    scene.add(meshPrefilterBox3);
    materialPrefilterBox.uniforms["roughness"].value = 0.75;
    cubeCameraPrefilter3.update( renderer, scene );
    scene.remove(meshPrefilterBox3);

    scene.add(meshPrefilterBox4);
    materialPrefilterBox.uniforms["roughness"].value = 1.0;
    cubeCameraPrefilter4.update( renderer, scene );
    scene.remove(meshPrefilterBox4);

    scene.background = cubeCameraPrefilter1.renderTarget;

    //scene.add(meshBox);

    renderer.setRenderTarget(bufferTexture);
    renderer.render(bufferScene, camera);
    renderer.setRenderTarget(null);

    scene.add(meshBallA);
    scene.add(meshBallB);

    flagEnvMap = false;
  }
  
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  render();
}

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);
}

// function onDocumentMouseMove(event) {
//   mouseX = (event.clientX - windowHalfX) * 10;
//   mouseY = (event.clientY - windowHalfY) * 10;
// }

init();
