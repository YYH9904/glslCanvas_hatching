#ifdef GL_ES
precision mediump float;
precision mediump int;
#endif

uniform vec2      u_resolution;
uniform sampler2D u_tex0;   // 原始照片

// =================== 工具函式 ===================

// 旋轉 2x2
mat2 rot(float a){
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// 簡單且穩定的 hash
float hash12(vec2 p){
  p = fract(p * vec2(443.8975, 397.2973));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
vec2 hash22(vec2 p){
  float n = hash12(p);
  return vec2(n, hash12(p + n + 7.23));
}

// 點到線段距離
float sdSegment(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// 亮度
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

// 平滑值噪聲（value noise）——用於 domain warp 打散格點同步
float valueNoise(vec2 x){
  vec2 i = floor(x);
  vec2 f = fract(x);
  // 四個角
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  // Hermite 曲線平滑
  vec2 u = f*f*(3.0 - 2.0*f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 取影像梯度 → 轉成「等亮線方向」（= 梯度法向）
float gradAngle(vec2 uv){
  vec2 texel = 1.0 / u_resolution;
  float Lx = luma(texture2D(u_tex0, uv + vec2(texel.x, 0.0)).rgb)
           - luma(texture2D(u_tex0, uv - vec2(texel.x, 0.0)).rgb);
  float Ly = luma(texture2D(u_tex0, uv + vec2(0.0, texel.y)).rgb)
           - luma(texture2D(u_tex0, uv - vec2(0.0, texel.y)).rgb);
  return atan(Ly, Lx) + 1.5707963; // 與梯度垂直
}

// =================== Scribble 層 ===================
// 回傳 0..1 覆蓋度。內含：多筆觸 + domain warp（打散圓團）
float scribbleLayer(vec2 uv, float density, float segLen, float width, float bend){
  // 以螢幕尺度計算，筆粗不因解析度改變
  vec2 p = (uv * u_resolution) / max(u_resolution.x, u_resolution.y);

  // ---- cell 尺度（越暗/越密 → cell 較小）----
  // 基準以像素間距感覺：sBase 越小越密
  float sBase = mix(22.0, 10.0, density); // 22(疏)~10(密)；可依喜好調
  float cell  = max(u_resolution.x, u_resolution.y) / sBase;

  // 初始格座標
  vec2 gp = p * (cell / max(u_resolution.x, u_resolution.y)); // 同上量綱

  // ---- Domain Warp：用平滑噪聲扭曲格網，避免規則點團 ----
  float wAmp = 0.45;              // 扭曲量（越大越不規則）
  vec2  n2   = vec2(valueNoise(gp*1.73 + 13.2), valueNoise(gp*1.61 - 9.1));
  gp += (n2 - 0.5) * wAmp;

  vec2 id = floor(gp);            // cell id
  vec2 fu = fract(gp) - 0.5;      // cell 內局部座標（中心為 0）

  // 影像導向角（沿等亮線）+ 少量隨機
  float aImg = gradAngle(uv);

  // 兩筆觸（固定小回圈，避免 GPU 不支持動態長度）
  float ink = 0.0;
  for (int k = 0; k < 2; ++k){
    // 每筆觸自己的亂數（依 id + k）
    vec2  rnd = hash22(id + float(k)*3.17);
    float ang = aImg + (rnd.x - 0.5) * 0.18;    // 比前版更小的隨機角，貼形體
    vec2  off = (rnd - 0.5) * 0.22;             // 輕微位移，避免都在中心
    vec2  q   = fu + off;

    // 直線端點（更長更細）+ 中段微彎
    vec2 dir = normalize(rot(ang) * vec2(1.0, 0.0));
    vec2 a   = -0.5 * segLen * dir;
    vec2 b   =  0.5 * segLen * dir;

    float t   = clamp(dot(q - a, dir) / max(segLen, 1e-4), 0.0, 1.0);
    vec2  mid = mix(a, b, t);
    vec2  nrm = vec2(-dir.y, dir.x);
    float curv = bend * sin(3.14159 * (t - 0.5));
    vec2  cpt  = mid + nrm * curv;

    float d = min(sdSegment(q, a, cpt), sdSegment(q, cpt, b));
    float stroke = smoothstep(width, width * 0.65, d);

    // 隨機稀疏（避免每格必有一大坨）
    float keep = step(0.12 + 0.35*(1.0-density), rnd.y); // 暗處多、亮處少
    ink = max(ink, stroke * keep);
  }

  return ink;
}

// =================== 主程式 ===================
void main(){
  vec2 uv  = gl_FragCoord.xy / u_resolution;
  vec3 src = texture2D(u_tex0, uv).rgb;
  float L  = luma(src);  // 0=黑 1=白

  // -------- 連續參數映射（三組：暗/中/亮） --------
  float segDark = 0.45, segMid = 0.35, segLite = 0.25;
  float widDark = 0.026, widMid = 0.022, widLite = 0.018;
  float benDark = 0.030, benMid = 0.025, benLite = 0.018;

  float t  = clamp(L*2.0, 0.0, 2.0);
  float t1 = clamp(t, 0.0, 1.0);
  float t2 = clamp(t-1.0, 0.0, 1.0);

  float segLen = mix(segDark, segMid, t1);
        segLen = mix(segLen, segLite, t2);

  float width  = mix(widDark, widMid, t1);
        width  = mix(width,  widLite, t2);

  float bend   = mix(benDark, benMid, t1);
        bend   = mix(bend,  benLite, t2);

  // 密度：暗處更密
  float density = mix(0.15, 0.95, 1.0 - L);

  // -------- 主層 + 兩層淡疊 --------
  float cov  = 0.70 * scribbleLayer(uv, density,        segLen,        width,        bend);
        cov += 0.20 * scribbleLayer(uv + vec2( 0.37, 0.11),
                                    mix(0.8, 0.2, L), segLen*0.82, width*0.63, bend*0.83);
        cov += 0.10 * scribbleLayer(uv + vec2(-0.21, 0.29),
                                    mix(0.7, 0.15, L), segLen*1.10, width*0.53, bend*1.15);
  cov = clamp(cov, 0.0, 1.0);

  // -------- 邊緣加強（Sobel） --------
  vec2 texel = 1.0 / u_resolution;
  float c00 = luma(texture2D(u_tex0, uv + texel*vec2(-1,-1)).rgb);
  float c10 = luma(texture2D(u_tex0, uv + texel*vec2( 0,-1)).rgb);
  float c20 = luma(texture2D(u_tex0, uv + texel*vec2( 1,-1)).rgb);
  float c01 = luma(texture2D(u_tex0, uv + texel*vec2(-1, 0)).rgb);
  float c21 = luma(texture2D(u_tex0, uv + texel*vec2( 1, 0)).rgb);
  float c02 = luma(texture2D(u_tex0, uv + texel*vec2(-1, 1)).rgb);
  float c12 = luma(texture2D(u_tex0, uv + texel*vec2( 0, 1)).rgb);
  float c22 = luma(texture2D(u_tex0, uv + texel*vec2( 1, 1)).rgb);

  float gx = -c00 - 2.0*c01 - c02 + c20 + 2.0*c21 + c22;
  float gy =  c00 + 2.0*c10 + c20 - c02 - 2.0*c12 - c22;
  float edge = clamp(length(vec2(gx, gy)) * 1.2, 0.0, 1.0);

  cov = max(cov, edge * 0.45);   // 0.45 可調

  // -------- 亮度連續調制 --------
  float gamma = 1.35;
  float tone  = 1.0 - pow(L, gamma); // 暗→大、亮→小
  cov *= mix(0.75, 1.20, tone);
  cov = clamp(cov, 0.0, 1.0);

  // -------- 原圖的色彩上色 --------
  vec3 ink   = clamp(normalize(src + 1e-4) * 0.8, 0.0, 1.0);
  vec3 paper = vec3(1.0);
  vec3 outRGB = mix(paper, ink, cov);

  gl_FragColor = vec4(outRGB, 1.0);
}
