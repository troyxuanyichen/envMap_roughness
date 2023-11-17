uniform samplerCube tCube;

varying vec3 cubeMapTexcoord;

vec3 hdrDecode(vec4 encoded){
    float exponent = encoded.a * 256.0 - 128.0;
    vec3 mantissa = encoded.rgb;
    return exp2(exponent) * mantissa;
}

void main(){
    vec4 color = textureCube(tCube, cubeMapTexcoord);
    vec3 envColor = hdrDecode(color);
    gl_FragColor = vec4(envColor, 1.0);
}