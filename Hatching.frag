// Author: YH
// Title: Learning Shaders (Color-preserving, light tint)

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_tex0; // 原圖
uniform sampler2D u_tex1; // hatch_0.jpg（最亮端過渡前一層）
uniform sampler2D u_tex2; // hatch_1.jpg
uniform sampler2D u_tex3; // hatch_2.jpg
uniform sampler2D u_tex4; // hatch_3.jpg
uniform sampler2D u_tex5; // hatch_4.jpg
uniform sampler2D u_tex6; // hatch_5.jpg（最暗端）


void main()
{
    vec2 uv= gl_FragCoord.xy/u_resolution.xy;
    vec2 vUv=fract(6.0*uv);                        //key
uv.x *= u_resolution.x / u_resolution.y;  
float shading= texture2D(u_tex0, uv).g; //取MonaLisa綠色版作為明亮值


    vec4 c;
                float step = 1. / 6.;
                if( shading <= step ){   
                    c = mix( texture2D( u_tex6, vUv ), texture2D( u_tex5, vUv ), 6. * shading );
                }
                if( shading > step && shading <= 2. * step ){
                    c = mix( texture2D( u_tex5, vUv ), texture2D( u_tex4, vUv) , 6. * ( shading - step ) );
                }
                if( shading > 2. * step && shading <= 3. * step ){
                    c = mix( texture2D( u_tex4, vUv ), texture2D( u_tex3, vUv ), 6. * ( shading - 2. * step ) );
                }
                if( shading > 3. * step && shading <= 4. * step ){
                    c = mix( texture2D( u_tex3, vUv ), texture2D( u_tex2, vUv ), 6. * ( shading - 3. * step ) );
                }
                if( shading > 4. * step && shading <= 5. * step ){
                    c = mix( texture2D( u_tex2, vUv ), texture2D( u_tex1, vUv ), 6. * ( shading - 4. * step ) );
                }
                if( shading > 5. * step ){
                    c = mix( texture2D( u_tex1, vUv ), vec4( 1. ), 6. * ( shading - 5. * step ) );
                }
                
     vec4 inkColor = vec4(0.0, 0.0, 1.0, 1.0);
     vec4 src = mix( mix( inkColor, vec4( 1. ), c.r ), c, .5 );
     gl_FragColor = src;


    

}


void main()
{
    // 基本座標
    vec2 uv  = gl_FragCoord.xy / u_resolution.xy;
    vec2 vUv = fract(6.0 * uv);      // 紋理平鋪座標（沿用你的 key）

    // 用與你一致的寬高比校正座標來取原圖與亮度
    vec2 imgUv = uv;
    uv.x *= u_resolution.x / u_resolution.y; 
    imgUv.x *= u_resolution.x / u_resolution.y;

    // 以原圖「藍色通道」作為明暗值
    float shading = texture2D(u_tex0, imgUv).b;

    // 六段分層
    vec4 c;
    float stepv = 1.0 / 6.0;
    if (shading <= stepv){
        c = mix(texture2D(u_tex6, vUv), texture2D(u_tex5, vUv), 6.0 * shading);
    }
    if (shading > stepv && shading <= 2.0 * stepv){
        c = mix(texture2D(u_tex5, vUv), texture2D(u_tex4, vUv), 6.0 * (shading - stepv));
    }
    if (shading > 2.0 * stepv && shading <= 3.0 * stepv){
        c = mix(texture2D(u_tex4, vUv), texture2D(u_tex3, vUv), 6.0 * (shading - 2.0 * stepv));
    }
    if (shading > 3.0 * stepv && shading <= 4.0 * stepv){
        c = mix(texture2D(u_tex3, vUv), texture2D(u_tex2, vUv), 6.0 * (shading - 3.0 * stepv));
    }
    if (shading > 4.0 * stepv && shading <= 5.0 * stepv){
        c = mix(texture2D(u_tex2, vUv), texture2D(u_tex1, vUv), 6.0 * (shading - 4.0 * stepv));
    }
    if (shading > 5.0 * stepv){
        c = mix(texture2D(u_tex1, vUv), vec4(1.0), 6.0 * (shading - 5.0 * stepv));
    }

    // —— 上色：清淡、保留原圖色彩 ——
    // c.r 越亮 = 越接近白紙；用它把原圖往紙色推，得到淡彩感
    vec3 base  = texture2D(u_tex0, imgUv).rgb;   // 原圖顏色
    float mask = c.r;                            // 白紙比例
    const float FADE = 0.6;                      // 淡化強度：0.3~0.8 可調
    vec3 paper = vec3(1.0);

    vec3 finalRGB = mix(base, paper, mask * FADE);
    gl_FragColor = vec4(finalRGB, 1.0);
}


