varying vec2 texcoord;

const float PI = 3.1415926;

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

float geometrySub(float NdotL, float mappedRough){
    float numerator = NdotL;
    float denominator = NdotL * (1.0 - mappedRough) + mappedRough;
    return numerator / denominator;
}

float geometry(float NdotL, float NdotV, float rough){
    float mappedRough = rough * rough / 2.0; // special mapping method for IBL
    float geoLight = geometrySub(NdotL, mappedRough);
    float geoView = geometrySub(NdotV, mappedRough);
    return geoLight * geoView;
}

void main(){

    float NdotV = texcoord.x;
    float roughness = texcoord.y;

    vec3 N = vec3(0.0, 0.0, 1.0);
    vec3 V;
    V.z = NdotV;
    V.x = sqrt(1.0 - NdotV * NdotV);
    V.y = 0.0;

    const int SAMPLE_COUNT = 1024;
    float A = 0.0;
    float B = 0.0;
    for(int i = 0; i < SAMPLE_COUNT; i++){
        vec2 Xi = HammersleyNoBitOps(i, SAMPLE_COUNT);
        // skew the generated stochastic directions more into the NDF lobe
        vec3 H = ImportanceSampleGGX(Xi, N, roughness); 
        vec3 L = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        float NdotH = max(H.z, 0.0);
        float VdotH = max(dot(V, H), 0.0);

        if(NdotL > 0.0){
            float G = geometry(NdotL, NdotV, roughness);
            float G_Vis = (G / (NdotV * NdotH)) * VdotH;
            float Fc = pow(1.0 - VdotH, 5.0);
            A += (1.0 - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);

    gl_FragColor = vec4(A, B, 0.0, 1.0);
}