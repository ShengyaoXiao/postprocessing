THREE.Shader1 = {

	uniforms: {
            texture1: {type: "t", value: null},
            scale: {type: "f", value: 1.0},
	},

	vertexShader: [

                        "varying vec3 fNormal;",
                        
                        "void main() {",

                            "fNormal = normal;",

                            "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

                        "}"

	].join("\n"),

	fragmentShader: [
                        // varying variable so we must defind it in both vs and fs 
                        // its purpose is to carry the value copied from the attribute 
                        // "normal" to the fragment shader. 
                        "varying vec3 fNormal;",

			"void main( void ) {",

                            // compose the colour using the normals then 
                            // whatever is heightened by the noise is lighter
                            "gl_FragColor = vec4( fNormal, 1. );",

                        "}"

	].join("\n")

};