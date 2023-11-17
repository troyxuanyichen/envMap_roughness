varying vec3 cubeMapTexcoord;
//varying vec3 vNormal;

void main(){
    cubeMapTexcoord = position;
    //vNormal = mat3(modelMatrix) * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}