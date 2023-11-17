varying vec3 fragPos;
varying vec3 vNormal;

uniform vec3 albedo;
uniform float metallic;
uniform float rough;
uniform vec3 directionalLightDir;
uniform float lightStrength;
uniform samplerCube tCube;

uniform samplerCube prefilterCube0;
uniform samplerCube prefilterCube1;
uniform samplerCube prefilterCube2;
uniform samplerCube prefilterCube3;
uniform samplerCube prefilterCube4;
uniform float prefilterScale;

uniform sampler2D BRDFlut;

const float PI = 3.1415926;

vec3 F0;
float E_o;

float distribution(vec3 halfDir, vec3 normal, float rough){
    float rough2 = rough * rough;
    float NdotH = max(dot(normal, halfDir), 0.0);
    float numerator = rough2;
    float media = NdotH * NdotH * (rough2 - 1.0) + 1.0;
    float denominator = PI * media * media;
    return numerator / max(denominator, 0.001);
}

float geometrySub(float NdotL, float mappedRough){
    float numerator = NdotL;
    float denominator = NdotL * (1.0 - mappedRough) + mappedRough;
    return numerator / denominator;
}

float geometry(float NdotL, float NdotV, float rough){
    float mappedRough = (rough + 1.0) * (rough + 1.0) / 8.0;
    float geoLight = geometrySub(NdotL, mappedRough);
    float geoView = geometrySub(NdotV, mappedRough);
    return geoLight * geoView;
}

vec3 fresnel(vec3 baseReflect, vec3 viewDir, vec3 halfDir){
    float HdotV = clamp(dot(halfDir, viewDir), 0.0, 1.0);
    float media = pow((1.0 - HdotV), 5.0);
    return baseReflect + (1.0 -baseReflect) * media;
}

vec3 fresnelRoughness(float cosTheta, vec3 F0, float roughness)
{
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
}

vec3 samplePrefilter(vec3 cubeMapTexcoord){
    int prefilterLevel = int(floor(prefilterScale));
    float coeMix = prefilterScale - float(prefilterLevel);
    vec3 colorA, colorB, colorP;
    if(prefilterLevel == 0){
        colorA = textureCube(prefilterCube0, cubeMapTexcoord).xyz;
        colorB = textureCube(prefilterCube1, cubeMapTexcoord).xyz;
    }
    else if(prefilterLevel == 1){
        colorA = textureCube(prefilterCube1, cubeMapTexcoord).xyz;
        colorB = textureCube(prefilterCube2, cubeMapTexcoord).xyz;
    }
    else if(prefilterLevel == 2){
        colorA = textureCube(prefilterCube2, cubeMapTexcoord).xyz;
        colorB = textureCube(prefilterCube3, cubeMapTexcoord).xyz;
    }
    else if(prefilterLevel == 3){
        colorA = textureCube(prefilterCube3, cubeMapTexcoord).xyz;
        colorB = textureCube(prefilterCube4, cubeMapTexcoord).xyz;
    }
    else{
        colorA = textureCube(prefilterCube4, cubeMapTexcoord).xyz;
        colorB = textureCube(prefilterCube4, cubeMapTexcoord).xyz;
    }
    colorP = mix(colorA, colorB, coeMix);
    return colorP;
}

/*************************Multiple Scattering (for explicit light source)*************************/
// Eavg in the algorithm is fitted into this
float AverageEnergy(float rough){
    float smoothness = 1.0 - rough;
    float r = -0.0761947 - 0.383026 * smoothness;
          r = 1.04997 + smoothness * r;
          r = 0.409255 + smoothness * r;
    return min(0.9, r); 
}

// Favg in the algorithm is fitted into this
vec3 AverageFresnel(vec3 specularColor){
    return specularColor + (vec3(1.0) - specularColor) * (1.0 / 21.0);
}

vec3 multiScatterBRDF(float NdotL, float NdotV, float rough){
    //E(μ) is in fact the sum of the red and green channels in our environment BRDF
    vec2 sampleE_o = texture2D(BRDFlut, vec2(NdotV, rough)).xy;
    E_o = sampleE_o.x + sampleE_o.y;
    float oneMinusE_o = 1.0 - E_o;
    vec2 sampleE_i = texture2D(BRDFlut, vec2(NdotL, rough)).xy;
    float oneMinusE_i = 1.0 - (sampleE_i.x + sampleE_i.y);

    float Eavg = AverageEnergy(rough);
    float oneMinusEavg = 1.0 - Eavg;
    vec3 Favg = AverageFresnel(F0);

    float brdf = (oneMinusE_o * oneMinusE_i) / (PI * oneMinusEavg);
    vec3 energyScale = (Favg * Favg * Eavg) / (vec3(1.0) - Favg * oneMinusEavg);

    return brdf * energyScale;
}
/**************************************************************************************************/

// Lighting computation with explicit light source (not ambient light)
vec3 explicitLighting(vec3 normal, vec3 viewDir, float NdotV){
    vec3 lightDir = normalize(directionalLightDir);
    vec3 halfDir = normalize(viewDir + lightDir);
    float NdotL = max(dot(normal, lightDir), 0.0);
        
    float D = distribution(halfDir, normal, rough);
    vec3 F = fresnel(F0, viewDir, halfDir);
    float G = geometry(NdotL, NdotV, rough);

    vec3 kd = vec3(1.0) - F;
    kd *= 1.0 - metallic;
    vec3 difBRDF = kd * albedo / PI;
    vec3 specBRDF = D * F * G / max((4.0 * NdotV * NdotL), 0.001);
    vec3 msBRDF = multiScatterBRDF(NdotL, NdotV, rough);
    vec3 BRDF = difBRDF + specBRDF + msBRDF;

    vec3 radiance = vec3(lightStrength);

    return BRDF * radiance * NdotL;
}

void main(){
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - fragPos);
    vec3 R = reflect(-viewDir, normal); // the NDF lobe is on the reflective directin of view direction
    float NdotV = max(dot(normal, viewDir), 0.0);
    F0 = mix(vec3(0.04), albedo, metallic);
    vec3 colorFromLight = explicitLighting(normal, viewDir, NdotV);

    vec3 F = fresnelRoughness(NdotV, F0, rough);
    vec3 kS = F;
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic;

    vec3 prefilteredColor = samplePrefilter(R);
    vec2 brdf = texture2D(BRDFlut, vec2(NdotV, rough)).xy;
    vec3 ambientDiffuse = kD * albedo * textureCube(tCube, normal).rgb;
    vec3 envSpecBRDFss = F * brdf.x + brdf.y;
    vec3 multiScatterScale = F0 * (1.0 - E_o) / E_o + vec3(1.0);// Multiple Scattering (for ambient light)
    vec3 ambientSpecular = prefilteredColor * multiScatterScale * envSpecBRDFss;
    vec3 ambient = ambientDiffuse + ambientSpecular;
    vec3 color = ambient + colorFromLight;
    // HDR tonemapping
    color = color / (color + vec3(1.0));
    // gamma correct
    color = pow(color, vec3(1.0/2.2)); 

    gl_FragColor = vec4(color, 1.0);

    // if(G == 0.0)
    //     gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    // else
    //     gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);

    // float fakeRough = clamp(rough, 0.0, 1.0);
    // gl_FragColor = vec4(vec3(fakeRough), 1.0);

    
    // if(color.x == 0.0 || color.y == 0.0 || color.z == 0.0)
    //     gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); 
    // else   
    //     gl_FragColor = vec4(color, 1.0);
}