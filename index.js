const FOV = 45;
const NEAR = 0.1;
const FAR = 1000; 
const SHADOW_MAP_SIZE = 1024;

var height = window.innerHeight;
var width = window.innerWidth;

var ASPECT = width / height;

var renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setClearColor(0x000000);
renderer.setSize(width, height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.renderReverseSided = false;

document.body.appendChild(renderer.domElement);

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
camera.lookAt(new THREE.Vector3(0, 0, 0));
camera.position.set(-2, 2, 2);

var controls = new THREE.OrbitControls(camera, renderer.domElement);

const matNormal = new THREE.MeshNormalMaterial();

const floorGeo = new THREE.PlaneBufferGeometry(3.0, 3.0);
const floor = new THREE.Mesh(floorGeo, matNormal);
floor.position.set(0, -0.5, 0);
floor.rotation.x = -((Math.PI * 90)/180);
floor.receiveShadow = true; 

const sphereGeo = new THREE.SphereBufferGeometry(0.5, 32, 32);
const sphere = new THREE.Mesh(sphereGeo, matNormal);
sphere.castShadow = true;
sphere.receiveShadow = true;

const coneGeo = new THREE.ConeGeometry(0.3, 1, 32);
const cone = new THREE.Mesh(coneGeo, matNormal);
cone.position.set(-1.0, 0, 0);
cone.castShadow = true;
cone.receiveShadow = true;

scene.add(floor);
scene.add(sphere);
scene.add(cone);
scene.add(camera);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(-1, 1.75, 1);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = SHADOW_MAP_SIZE;
directionalLight.shadow.mapSize.height = SHADOW_MAP_SIZE;
directionalLight.shadow.camera.far = 3500;
directionalLight.shadow.bias = -0.0001;

scene.add(directionalLight);

// The pink part is missing since the shader in Shadertoy secretly renders shadows
// to an alpha channel that wasn;t visible in the first place as we can see in the
// picture.
// We used the forward one by adding a material that holds the shadows. These must be 
// handled in an additional render pass. 
// A MeshPhonMaterial can hold shadows. While a new render target saves them. 
// Again, a sesize function is needed. 
const matShadow = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 0.0
})

const PARAMS = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBFormat,
    stencilBuffer: false
}
// A render target is a buffer where the video card draws pixels for a scene that
// is being rendered in the background. it is used in different effects, such as 
// applying postprcessing to a rendered image before displaying on the screen. 

const shadowBuffer = new THREE.WebGLRenderTarget(1, 1, PARAMS);
shadowBuffer.setSize(width, height);

window.addEventListener('resize', onWindowResize, false);

const VERTEX = `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// The shader definition also defines a Unifrom called tDiffuse used by
// the EffectComposer. It contains the image from the previous rendering
// pass that will be altered in the current pass. 
const FRAGMENT = `
    varying vec2 vUv;

    uniform sampler2D tDiffuse;
    uniform sampler2D tShadow;
    uniform vec2 iResolution;
    
    // Edge detection Pass
    #define Sensitivity (vec2(0.3, 1.5) * iResolution.y / 400.0)
    float checkSame(vec4 center, vec4 samplef)
    {
        vec2 centerNormal = center.xy;
        float centerDepth = center.z;
        vec2 sampleNormal = samplef.xy;
        float sampleDepth = samplef.z;
        vec2 diffNormal = abs(centerNormal - sampleNormal) * Sensitivity.x;
        bool isSameNormal = (diffNormal.x + diffNormal.y) < 0.1;
        float diffDepth = abs(centerDepth - sampleDepth) * Sensitivity.y;
        bool isSameDepth = diffDepth < 0.1;
        return (isSameNormal && isSameDepth) ? 1.0 : 0.0;
    }
    void main()
    {
        vec4 sample0 = texture2D(tDiffuse, vUv);
        vec4 sample1 = texture2D(tDiffuse, vUv + (vec2(1.0, 1.0) / iResolution.xy));
        vec4 sample2 = texture2D(tDiffuse, vUv + (vec2(-1.0, -1.0) / iResolution.xy));
        vec4 sample3 = texture2D(tDiffuse, vUv + (vec2(-1.0, 1.0) / iResolution.xy));
        vec4 sample4 = texture2D(tDiffuse, vUv + (vec2(1.0, -1.0) / iResolution.xy));
        float edge = checkSame(sample1, sample2) * checkSame(sample3, sample4);
        // gl_FragColor = vec4(edge, sample0.w, 1.0, 1.0);
        float shadow = texture2D(tShadow, vUv).x;
        gl_FragColor = vec4(edge, shadow, 1.0, 1.0);
    }
`;

const FRAGMENT_FINAL = `
    uniform sampler2D tDiffuse;
    uniform sampler2D tNoise;
    uniform float iTime;

    varying vec2 vUv;

    #define EdgeColor vec4(0.2, 0.2, 0.15, 1.0)
    #define BackgroundColor vec4(1,0.95,0.85,1)
    #define NoiseAmount 0.01
    #define ErrorPeriod 30.0
    #define ErrorRange 0.003
    
    // Reference: https://www.shadertoy.com/view/MsSGD1
    float triangle(float x)
    {
        return abs(1.0 - mod(abs(x), 2.0)) * 2.0 - 1.0;
    }
    float rand(float x)
    {
        return fract(sin(x) * 43758.5453);
    }
    void main()
    {
        float time = floor(iTime * 16.0) / 16.0;
        vec2 uv = vUv;
        uv += vec2(triangle(uv.y * rand(time) * 1.0) * rand(time * 1.9) * 0.005,
        triangle(uv.x * rand(time * 3.4) * 1.0) * rand(time * 2.1) * 0.005);
        float noise = (texture2D(tNoise, uv * 0.5).r - 0.5) * NoiseAmount;
        vec2 uvs[3];
        uvs[0] = uv + vec2(ErrorRange * sin(ErrorPeriod * uv.y + 0.0) + noise, ErrorRange * sin(ErrorPeriod * uv.x + 0.0) + noise);
        uvs[1] = uv + vec2(ErrorRange * sin(ErrorPeriod * uv.y + 1.047) + noise, ErrorRange * sin(ErrorPeriod * uv.x + 3.142) + noise);
        uvs[2] = uv + vec2(ErrorRange * sin(ErrorPeriod * uv.y + 2.094) + noise, ErrorRange * sin(ErrorPeriod * uv.x + 1.571) + noise);
        float edge = texture2D(tDiffuse, uvs[0]).r * texture2D(tDiffuse, uvs[1]).r * texture2D(tDiffuse, uvs[2]).r;
        float diffuse = texture2D(tDiffuse, uv).g;
        float w = fwidth(diffuse) * 2.0;
        vec4 mCol = mix(BackgroundColor * 0.5, BackgroundColor, mix(0.0, 1.0, smoothstep(-w, w, diffuse - 0.3)));
        gl_FragColor = mix(EdgeColor, mCol, edge);
    }
`;

const VIGNETTE =  `
   varying vec2 vUv;

   uniform sampler2D tDiffuse;

   #define Radius 0.75
   #define Softness 0.45
   #define Sepia vec3(1.2, 1.0, 0.8)

   // Reference: https://github.com/mattdesl/lwjgl-basics/wiki/ShaderLesson3
   void main()
   {
       vec2 uv = vUv;
       vec2 center = uv - vec2(0.5);
       float len = length(center);
       float vignette = smoothstep(Radius, Radius - Softness, len);
       vec4 texColor = texture2D(tDiffuse, uv);
       texColor.rgb = mix(texColor.rgb, texColor.rgb * vignette, 0.5);
       float gray = dot(texColor.rgb, vec3(0.299, 0.687, 0.114));
       vec3 sepiaColor = vec3(gray) * Sepia;
       texColor.rgb = mix(texColor.rgb, sepiaColor, 0.75);
       gl_FragColor = texColor;
   }
`;

const resolution = new THREE.Vector2(width, height);

const drawShader = {
    uniforms: {
        tDiffuse: {type: 't', value: null},
        tShadow: {type: 't', value: null},
        iResolution: { type: 'v2', value: resolution }
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT
};

// This creates an EffectComposer Instance which adds a normal rendering pass
// and an additional shader pass. 
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));

// in this example, shading is completed by postprocessing
const pass = new THREE.ShaderPass(drawShader);
composer.addPass(pass);

const clock = new THREE.Clock();

const vignetteShader = {
    uniforms: {
        tDiffuse: { type: 't', value: null}
    },
    vertexShader: VERTEX,
    fragmentShader: VIGNETTE
};

const passVignette = new THREE.ShaderPass(vignetteShader);
passVignette.renderToScreen = true;

const finalShader = {
    uniforms: {
        tDiffuse: { type: 't', value: null},
        iTime: {type: 'f', value: 0.0},
        tNoise: {type: 't', value: new THREE.TextureLoader('noise.png')}
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT_FINAL
};

const passFinal = new THREE.ShaderPass(finalShader);
// passFinal.renderToScreen = true;
passFinal.material.extensions.derivatives = true;
composer.addPass(passFinal);
composer.addPass(passVignette);


function onWindowResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    ASPECT = width / height;
    camera.aspect = ASPECT;
    camera.updateProjectionMatrix();
    // resize!! 
    shadowBuffer.setSize(width, height);
    composer.setSize(width, height); 
    renderer.setSize(width, height);
    // It is important that we use the uniforms of the actual render pass. 
    // The original one has been deeply cloned by the EffectComposer; 
    // changing the variable resolution would have no effect.
    pass.uniforms.iResolution.value.set(width, height); 
}

function loop() {
    requestAnimationFrame(loop);
    controls.update();
    render();
}

// Now we can transfer the shadows to the new render target 
// and prepare it for the shader 
function render() {
    floor.material = matShadow;
    sphere.material = matShadow;
    renderer.render(scene, camera, shadowBuffer);
    // set shadow to a uniform
    pass.uniforms.tShadow.value = shadowBuffer.texture;

    // change the material back to MashNormalMaterial
    floor.material = matNormal;
    sphere.material = matNormal;
    
    const elapsed = clock.getElapsedTime();
    passFinal.uniforms.iTime.value = elapsed;
    
    composer.render();
}

render();
loop();
