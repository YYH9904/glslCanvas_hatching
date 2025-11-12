// 20200220_glsl Genetic Face_v0.frag
// Title: Genetic Face
// Reference: https://www.shadertoy.com/view/XsGXWW

//#version 300 es
//#extension GL_OES_standard_derivatives : enable

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define iTime u_time
#define iResolution u_resolution
#define iMouse u_mouse
#define fragCoord gl_FragCoord.xy
uniform sampler2D u_tex0;		//data/CMH_oil_sad.png
uniform sampler2D u_tex1;       //data/CMH_oil_joy.png
uniform sampler2D u_buffer0;	//FBO from previous iterated frame


//#define SOURCE_COLORS
#define EVERY_PIXEL_SAME_COLOR
#define TRIANGLES
#define CIRCLES
#define CIRCLE_PATTERN

//Randomness code from Martin, here: https://www.shadertoy.com/view/XlfGDS
float Random_Final(vec2 uv, float seed)
{
    float fixedSeed = abs(seed) + 1.0;
    float x = dot(uv, vec2(12.9898,78.233) * fixedSeed);
    return fract(sin(x) * 43758.5453);
}

//Test if a point is in a triangle
bool pointInTriangle(vec2 triPoint1, vec2 triPoint2, vec2 triPoint3, vec2 testPoint)
{
    float denominator = ((triPoint2.y - triPoint3.y)*(triPoint1.x - triPoint3.x) + (triPoint3.x - triPoint2.x)*(triPoint1.y - triPoint3.y));
    float a = ((triPoint2.y - triPoint3.y)*(testPoint.x - triPoint3.x) + (triPoint3.x - triPoint2.x)*(testPoint.y - triPoint3.y)) / denominator;
    float b = ((triPoint3.y - triPoint1.y)*(testPoint.x - triPoint3.x) + (triPoint1.x - triPoint3.x)*(testPoint.y - triPoint3.y)) / denominator;
    float c = 1.0 - a - b;
 
    return 0.0 <= a && a <= 1.0 && 0.0 <= b && b <= 1.0 && 0.0 <= c && c <= 1.0;
}

//Simple circular mask so we can optionally gate mutations by disks instead of triangles
bool pointInCircle(vec2 center, float radius, vec2 testPoint)
{
    return distance(testPoint, center) <= radius;
}

void main()
{
    vec2 imageUV  = fragCoord.xy / iResolution.xy;
    vec2 testUV = imageUV;

#ifdef EVERY_PIXEL_SAME_COLOR
    testUV = vec2(1.0, 1.0);   // force the same random seed for all pixels so everyone proposes the same triangle/color each frame
#endif

    // derive three pseudo-random vertices that define the candidate mutation triangle
    vec2 triPoint1 = vec2(Random_Final(testUV, iTime), Random_Final(testUV, iTime * 2.0));
    vec2 triPoint2 = vec2(Random_Final(testUV, iTime * 3.0), Random_Final(testUV, iTime * 4.0));
    vec2 triPoint3 = vec2(Random_Final(testUV, iTime * 5.0), Random_Final(testUV, iTime * 6.0));

    // candidate color either comes from pure randomness or (optionally) sourced from u_tex1
    vec4 testColor = vec4(Random_Final(testUV, iTime * 10.0),
                          Random_Final(testUV, iTime * 11.0),
                          Random_Final(testUV, iTime * 12.0),
                          1.0);

#ifdef SOURCE_COLORS
    vec2 colorUV = vec2(Random_Final(testUV, iTime * 10.0),
                        Random_Final(testUV, iTime * 11.0));

    testColor = texture( u_tex1, colorUV );
#endif
    
    vec4 trueColor = texture2D( u_tex0, imageUV );    // target portrait we try to approximate
    vec4 prevColor = texture2D( u_buffer0, imageUV ); // accumulated framebuffer from previous iteration
    testColor = mix(prevColor, testColor, 0.5);    // blend candidate color with previous color for smoother transitions

    gl_FragColor = prevColor;

    bool isInTriangle = true;
    bool isInCircle = true;

#ifdef TRIANGLES
    isInTriangle = pointInTriangle(triPoint1, triPoint2, triPoint3, imageUV); // only pixels inside the candidate triangle can mutate
#endif

#ifdef CIRCLES
    vec2 circleCenter = vec2(Random_Final(testUV, iTime * 7.0), Random_Final(testUV, iTime * 8.0)); // random disk center
    float circleRadius = 0.2 + Random_Final(testUV, iTime * 9.0) * 0.3; // keep radius in a usable range
    isInCircle = pointInCircle(circleCenter, circleRadius, imageUV);
#endif
    // original
    /*if(isInTriangle && abs(length(trueColor - testColor)) < abs(length(trueColor - prevColor)))
    {  gl_FragColor = testColor;}*/

    // modified for forward and backward evolution
    if(isInTriangle && isInCircle)
    {
        float prevDiff = abs(length(trueColor - prevColor));   // current error vs. target
        float testDiff = abs(length(trueColor - testColor));   // candidate error vs. target
        float score = prevDiff-testDiff;
        if(u_time < 20.0 && score < 0.0) gl_FragColor = testColor;          // backwards evolution phase keeps worse candidates
        else if(u_time >= 20.0 && score > 0.0) gl_FragColor = testColor;    // after 20s only improvements are accepted
        
    }

#ifdef CIRCLE_PATTERN
    // Overlay a tiled circle pattern to emphasize the evolving strokes
    vec2 patternUV = fract(imageUV * 16.0) - 0.5;      // repeat pattern 16 times across the image
    float ring = smoothstep(0.28, 0.24, length(patternUV)); // soft circle mask
    gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.6, ring); // darken color where circle is present
#endif

}
