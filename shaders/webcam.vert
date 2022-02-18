// see https://github.com/aferriss/p5jsShaderExamples

// vertex data
attribute vec3 aPosition;
attribute vec2 aTexCoord;

// texcoords
varying vec2 vTexCoord;

void main() {
    // cp
    vTexCoord = aTexCoord;

    // cp position data to vec4, 1.0 = w component
    vec4 positionVec4 = vec4(aPosition, 1.0);
    positionVec4.xy = positionVec4.xy * 2.0 - 1.0;

    // send vertex info to fragment shader
    gl_Position = positionVec4;
}
