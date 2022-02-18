// see char stiles workshop http://charstiles.com/webcam-shaders/ its great

precision mediump float;

// texcoords from vert shader
varying vec2 vTexCoord;

// video texture
uniform sampler2D video;

// time
uniform float time;

// offset
uniform float offset;

// backbuffer
uniform sampler2D backbuffer;


vec3 cosPalette( float t, vec3 a, vec3 b, vec3 c, vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
}

void main() {
    vec2 uv = vTexCoord;

    // have to flip tex
    uv.y = 1.0 - uv.y;


    // r,g,b
    vec3 brightness = vec3(0.5,0.5,0.5);
    vec3 contrast =  vec3(0.2,sin(time)*0.2,cos(time)*0.2);
    vec3 osc = vec3(0.2); // frequency
    vec3 phase = vec3(0.5); // start

    // cosine palette
    vec3 cp = cosPalette((time/1.0) + uv.x, brightness, contrast, osc, phase );
    // casting the cosinePalette into a vector 4
    vec4 col = vec4(cp,1);

    vec4 tex = texture2D(video, uv);

    // offset backbuffer for slitscan effect.
    vec4 prev = texture2D(backbuffer, uv - vec2(0, offset));

    // mix b/w 0 & 1
    col = mix(tex+col,prev,1.- tex );
    // this line makes it so that the slitscan effect happens where the web is light

    // blows out the prev texture
    col = mix(col,prev,tex*1.3 );
    // this preserves some of the webcam information
    col = min(max(col,prev), tex+ 0.4);

    // for dark
    // col = mix(col,prev,(tex)*1.90 );
    // col = mix(max(col,prev),tex, tex-0.15);

    // render the output
    gl_FragColor = col;
}
