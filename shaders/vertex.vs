varying vec3 fragPos;
varying vec3 vNormal;

void main(){
    fragPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = mat3(modelMatrix) * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}