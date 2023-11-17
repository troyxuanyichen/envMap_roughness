uniform samplerCube tCube;
uniform float roughness;

varying vec3 cubeMapTexcoord;

const float PI = 3.1415926;
//const float sampleDelta = 0.10;//0.025;

// low-discrepancy sequence generateor specially for WebGL implementation
float VanDerCorpus(int n, int base){
    float invBase = 1.0 / float(base);
    float denom   = 1.0;
    float result  = 0.0;

    for(int i = 0; i < 32; ++i){
        if(n > 0){
            denom   = mod(float(n), 2.0);
            result += denom * invBase;
            invBase = invBase / 2.0;
            n       = int(float(n) / 2.0);
        }
    }

    return result;
}

vec2 HammersleyNoBitOps(int i, int N){
    return vec2(float(i)/float(N), VanDerCorpus(i, 2));
}

vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness){
    float a = roughness * roughness;

    // in spherical space
    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

    // from spherical space to cartesian space
    vec3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;

    // tangent coordinates
    vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(N, up));
    vec3 bitangent = cross(N, tangent);

    // transform H to tangent space
    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
}

void main(){
    vec3 N = normalize(cubeMapTexcoord);
    vec3 V = N;/*this simplification may turn the NDF lobe from anisotropic to isotropic, 
                which makes reflection doesn't strech when looked in grazing angle*/
    vec3 R = N;

    const int SAMPLE_COUNT = 1024;
    vec3 color = vec3(0.0);
    float totalWeight = 0.0;
    for(int i = 0; i < SAMPLE_COUNT; i++){
        vec2 Xi = HammersleyNoBitOps(i, SAMPLE_COUNT);
        // skew the generated stochastic directions more into the NDF lobe
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        if(NdotL > 0.0){
            color += textureCube(tCube, L).rgb * NdotL;
            totalWeight += NdotL;
        }
    }
    color /= totalWeight;

    gl_FragColor = vec4(color, 1.0);
}