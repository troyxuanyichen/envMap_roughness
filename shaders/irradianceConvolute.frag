uniform samplerCube tCube;

varying vec3 cubeMapTexcoord;

const float PI = 3.1415926;
const float sampleDelta = 0.10;//0.025;

void main(){
    
    // tangent space coordinate axis
    vec3 N = normalize(cubeMapTexcoord);
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 right = cross(up, N);
    up = cross(N, right);

    float nrSamples = 0.0;
    vec3 irradiance = vec3(0.0);
    for(float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta){
        float cosPhi = cos(phi);
        float sinPhi = sin(phi);
        for(float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta){
            float cosTheta = cos(theta);
            float sinTheta = sin(theta);
            // in tangent space: transfer spherical to cartesian
            vec3 tangentDir = vec3(cosPhi * sinTheta, sinPhi * sinTheta, cosTheta);
            // transfer tengent to world 
            vec3 worldDir = tangentDir.x * right + tangentDir.y * up + tangentDir.z * N; 
            irradiance += textureCube(tCube, worldDir).rgb * cosTheta * sinTheta;
            nrSamples++;
        }
    }
    irradiance = irradiance * (1.0 / float(nrSamples)) * PI;

    gl_FragColor = vec4(irradiance, 1.0);
}