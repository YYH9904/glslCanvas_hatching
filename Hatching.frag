// Author: YH
// Title: Learning Shaders (Color-preserving, light tint)

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_tex0; // 原圖
uniform sampler2D u_tex1; // Hatch0.jpg（最亮端過渡前一層,極疏的紋理）
uniform sampler2D u_tex2; // Hatch1.jpg（圓點疏）
uniform sampler2D u_tex3; // Hatch2.jpg（圓點密）
uniform sampler2D u_tex4; // hatch_3.jpg（斜線中）
uniform sampler2D u_tex5; // Hatch_4.jpg（斜線密）
uniform sampler2D u_tex6; // Hatch5.jpg（最暗端, 厚重刷痕）

vec2 fitUV(vec2 uv, float imgAspect, float canvasAspect) {
    vec2 scale;
    if (imgAspect > canvasAspect) {
        // image wider → fit width
        scale = vec2(canvasAspect / imgAspect, 1.0);
    } else {
        // image taller → fit height
        scale = vec2(1.0, imgAspect / canvasAspect);
    }
    vec2 offset = (1.0 - scale) * 0.5;
    return offset + uv * scale; // stays within 0..1, no cropping
}


void main()
{
    // 基本座標
    vec2 uv  = gl_FragCoord.xy / u_resolution.xy;

    // show the entire image centered, with letterboxing/pillarboxing if the canvas ratio differs
    float canvasAspect = u_resolution.x / u_resolution.y;
    float imageAspect  = 1024.0 / 1536.0;   // = 0.6666667
    vec2 imgUv = fitUV(uv, imageAspect, canvasAspect);

    // 以原圖「藍色通道」作為明暗值
    float shading = texture2D(u_tex0, imgUv).b;

    // 六段分層
    vec2 vUv = fract(6.0 * uv);      // 紋理平鋪座標（key）
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
    vec3 base  = texture2D(u_tex0, imgUv).rgb;   // 原圖顏色(for color-preserving mix)

    float mask = 1.0 - c.r;                            // 白紙比例
    const float FADE = 0.6;                      // 淡化強度：0.3~0.8 可調
    vec3 paper = vec3(1.0);

    vec3 finalRGB = mix(base, paper, mask * FADE);
    gl_FragColor = vec4(finalRGB, 1.0);
    // gl_FragColor = texture2D(u_tex0, vUv);
}


