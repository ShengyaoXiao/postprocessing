THREE.Shader2 = {

	uniforms: {
            texture1: { type: "t", value: null },
            scale: { type: "f", value: 1.0 },
	},

	vertexShader: [

                        "varying vec2 vUv;",
                        "varying float noise;",
                        "varying vec3 fNormal;",
                        "uniform sampler2D texture1;",
                        "uniform float scale;",
                        
                        "void main() {",

                            "vUv = uv;",
                            "fNormal = normal;",
                            
                            // is used to read the current texel based on the current 
                            // UV co-ordinate of the vertex 
                            // think of uvs as flattered 2d representations of the geometry 
                            // uvs are often created when exported from a 3d program 
                            "vec4 noiseTex = texture2D( texture1, vUv );",
                            
                            // we only want the red values from the texture
                            // since we only need the texture's light and dark areas to make height information 
                            "noise = noiseTex.r;",
                            //adding the normal scales it outward
                            //(normal scale equals sphere diameter)
                            "vec3 newPosition = position + normal * noise * scale;",
                            // produces the vertices outward based on the noise value.
                            // adding the normal vector proudecs the vertices out. 
                            // The scale uniform is multiplied in as a way you can control
                            // the height of the extrusion.

                            "gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );",

                        "}"

	].join("\n"),

	fragmentShader: [

			"varying vec2 vUv;",
                        "varying float noise;",
                        "varying vec3 fNormal;",

			"void main( void ) {",

                            // compose the colour using the normals then 
                            // whatever is heightened by the noise is lighter
                            "gl_FragColor = vec4( fNormal * noise, 1. );",
                            // noise is multiplied into the color to make darknees 
                            // in the low areas and lighter the high ones 

                        "}"

	].join("\n")

};