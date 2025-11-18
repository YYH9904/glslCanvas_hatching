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
uniform sampler2D u_tex0;		//data/SND.JPG
uniform sampler2D u_tex1;       //data/Meadowfoamv3_byChatGPT.png
uniform sampler2D u_buffer0;	//FBO from previous iterated frame


//==================PASS A
#if defined( BUFFER_0 )

//#define SOURCE_COLORS
#define EVERY_PIXEL_SAME_COLOR
#define TRIANGLES

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

void main()
{
    vec2 imageUV  = fragCoord.xy / iResolution.xy;
    vec2 testUV = imageUV;

#ifdef EVERY_PIXEL_SAME_COLOR
    testUV = vec2(1.0, 1.0);   
#endif

    float iterationSeed = floor(iTime * 60.0); // force a new random configuration each frame
    vec2 circleCenter = vec2(Random_Final(testUV, iterationSeed + 1.0), Random_Final(testUV, iterationSeed + 2.0));
    float circleRadius = 0.05 + Random_Final(testUV, iterationSeed + 3.0) * 0.35;

    vec4 testColor = vec4(Random_Final(testUV, iterationSeed + 10.0),
                          Random_Final(testUV, iterationSeed + 11.0),
                          Random_Final(testUV, iterationSeed + 12.0),
                          1.0);

#ifdef SOURCE_COLORS
    vec2 colorUV = vec2(Random_Final(testUV, iterationSeed + 20.0),
                        Random_Final(testUV, iterationSeed + 21.0));

    testColor = texture( u_tex1, colorUV );
#endif
    
    vec4 trueColor = texture2D( u_tex0, imageUV );
    vec4 prevColor = texture2D( u_buffer0, imageUV );

    gl_FragColor = prevColor;

    bool isInCircle = distance(imageUV, circleCenter) <= circleRadius;

    // original
    /*if(isInTriangle && abs(length(trueColor - testColor)) < abs(length(trueColor - prevColor)))
    {  gl_FragColor = testColor;}*/

    // modified for forward and backward evolution
    if(isInCircle)
    {
        float prevDiff = abs(length(trueColor - prevColor));
        float testDiff = abs(length(trueColor - testColor));
        float score = prevDiff-testDiff;
        float alpha = 0.5; // make circles partially transparent
        if(u_time < 5.0 && score < 0.0) gl_FragColor = mix(prevColor, testColor, alpha);          //backwards evolution
        else if(u_time >= 5.0 && score > 0.0) gl_FragColor = mix(prevColor, testColor, alpha);    //forward evolution
        
    }

}


//==================Main Pass
#else

void main()
{
    vec2 uv=fragCoord/iResolution.xy;
    gl_FragColor = texture2D( u_buffer0, uv );
}

#endif
//==================End of File
