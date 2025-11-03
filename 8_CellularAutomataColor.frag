// Author:CMH
// Title:Cellular Automata 

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_tex0;
uniform sampler2D u_tex1;
uniform sampler2D u_buffer0;
uniform sampler2D u_buffer1;

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec2 uv = st;

    vec2 cellSize = 1.0 / u_resolution.xy * 16.0;
    vec2 cell = floor(uv / cellSize) * cellSize;

    // Parameters (tweak as needed)
    float ease = 0.0001;
    float minDist = 0.005; // normalized color distance threshold
    float minDistSquare = minDist * minDist;
    float sepNormMag = 0.1; 

    // Current cell color and velocity
    vec3 state = texture2D(u_buffer0, cell).rgb;
    vec3 vel = texture2D(u_buffer1, cell).rgb;

    // Neighbor accumulators
    float rAve = 0.0, gAve = 0.0, bAve = 0.0;
    float rVelAve = 0.0, gVelAve = 0.0, bVelAve = 0.0;
    float rSep = 0.0, gSep = 0.0, bSep = 0.0;
    int count = 0;

    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            if (x == 0 && y == 0) continue; // skip self
            vec2 offset = vec2(float(x), float(y)) * cellSize;
            vec3 neighbor = texture2D(u_buffer0, cell + offset).rgb;
            vec3 neighborVel = texture2D(u_buffer1, cell + offset).rgb;

            rAve += neighbor.r;
            gAve += neighbor.g;
            bAve += neighbor.b;
            rVelAve += neighborVel.r;
            gVelAve += neighborVel.g;
            bVelAve += neighborVel.b;

            float dr = state.r - neighbor.r;
            float dg = state.g - neighbor.g;
            float db = state.b - neighbor.b;
            float distSq = dr*dr + dg*dg + db*db;
            if (distSq < minDistSquare) {
                rSep += dr;
                gSep += dg;
                bSep += db;
            }
            count++;
        }
    }

    // Average neighbor values
    float f = 1.0 / float(count);
    rAve *= f; gAve *= f; bAve *= f;
    rVelAve *= f; gVelAve *= f; bVelAve *= f;

    // Normalize separation vector
    float sepLen = sqrt(rSep*rSep + gSep*gSep + bSep*bSep);
    if (sepLen > 0.0) {
        float sepMagRecip = sepNormMag / sepLen;
        rSep *= sepMagRecip;
        gSep *= sepMagRecip;
        bSep *= sepMagRecip;
    }

    // Update velocity
    float nextRVel = vel.r + ease * (rSep + rVelAve + rAve - state.r - vel.r);
    float nextGVel = vel.g + ease * (gSep + gVelAve + gAve - state.g - vel.g);
    float nextBVel = vel.b + ease * (bSep + bVelAve + bAve - state.b - vel.b);

    // Update color
    float nextR = state.r + nextRVel;
    float nextG = state.g + nextGVel;
    float nextB = state.b + nextBVel;

    // Bounce colors off boundaries (color cube [0,1])
    if (nextR < 0.0) {
        nextR = 0.0;
        nextRVel *= -1.0;
    } else if (nextR > 1.0) {
        nextR = 1.0;
        nextRVel *= -1.0;
    }
    if (nextG < 0.0) {
        nextG = 0.0;
        nextGVel *= -1.0;
    } else if (nextG > 1.0) {
        nextG = 1.0;
        nextGVel *= -1.0;
    }
    if (nextB < 0.0) {
        nextB = 0.0;
        nextBVel *= -1.0;
    } else if (nextB > 1.0) {
        nextB = 1.0;
        nextBVel *= -1.0;
    }

    // Clamp velocity (optional, not strictly needed)
    nextRVel = clamp(nextRVel, -1.0, 1.0);
    nextGVel = clamp(nextGVel, -1.0, 1.0);
    nextBVel = clamp(nextBVel, -1.0, 1.0);

    // FBO logic
    #if defined( BUFFER_0 )
    if(u_time < 1.0) gl_FragColor = texture2D(u_tex0, st);
    else gl_FragColor = vec4(nextR, nextG, nextB, 1.0);

    #elif defined( BUFFER_1 )
    if(u_time < 1.0) gl_FragColor =vec4(0.0, 0.0, 0.0, 1.0);
    else gl_FragColor = vec4(nextRVel, nextGVel, nextBVel, 1.0);

    #else
    gl_FragColor = texture2D(u_buffer0, st);
    #endif
}
