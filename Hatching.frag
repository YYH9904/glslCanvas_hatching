// Author: CMH
// Title: Learning Shaders


#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_tex0; //Pian.mp4
uniform sampler2D u_tex1;
uniform sampler2D u_tex2;
uniform sampler2D u_tex3;
uniform sampler2D u_tex4;
uniform sampler2D u_tex5;
uniform sampler2D u_tex6;
uniform sampler2D u_tex7;
uniform sampler2D u_tex8;
uniform sampler2D u_tex9;
uniform sampler2D u_tex10;

void main()
{
    vec2 uv= gl_FragCoord.xy/u_resolution.xy;
    vec2 vUv=fract(10.0*uv);                        //key
    float shading= texture2D(u_tex0, uv).b; //取藍色版作為明亮值


    vec4 c;
                float step = 1. / 10.;
                if( shading <= step ){   
                    c = mix( texture2D( u_tex10, vUv ), texture2D( u_tex9, vUv ), 10. * shading );
                }
                if( shading > step && shading <= 2. * step ){
                    c = mix( texture2D( u_tex9, vUv ), texture2D( u_tex8, vUv) , 10. * ( shading - step ) );
                }
                if( shading > 2. * step && shading <= 3. * step ){
                    c = mix( texture2D( u_tex8, vUv ), texture2D( u_tex7, vUv ), 10. * ( shading - 2. * step ) );
                }
                if( shading > 3. * step && shading <= 4. * step ){
                    c = mix( texture2D( u_tex7, vUv ), texture2D( u_tex6, vUv ), 10. * ( shading - 3. * step ) );
                }
                if( shading > 4. * step && shading <= 5. * step ){
                    c = mix( texture2D( u_tex6, vUv ), texture2D( u_tex5, vUv ), 10. * ( shading - 4. * step ) );
                }
                if( shading > 4. * step && shading <= 6. * step ){
                    c = mix( texture2D( u_tex5, vUv ), texture2D( u_tex4, vUv ), 10. * ( shading - 5. * step ) );
                }
                if( shading > 4. * step && shading <= 7. * step ){
                    c = mix( texture2D( u_tex4, vUv ), texture2D( u_tex3, vUv ), 10. * ( shading - 6. * step ) );
                }
                if( shading > 4. * step && shading <= 8. * step ){
                    c = mix( texture2D( u_tex3, vUv ), texture2D( u_tex2, vUv ), 10. * ( shading - 7. * step ) );
                }
                if( shading > 8. * step && shading <= 9. * step ){
                    c = mix( texture2D( u_tex2, vUv ), texture2D( u_tex1, vUv ), 10. * ( shading - 8. * step ) );
                }
                if( shading > 9. * step ){
                    c = mix( texture2D( u_tex1, vUv ), vec4( 1. ), 10. * ( shading - 9. * step ) );
                }
                
     vec4 inkColor = vec4(0.0, 0.0, 1.0, 1.0);
     vec4 src = mix( mix( inkColor, vec4( 1. ), c.r ), c, .9 );
     gl_FragColor = src;


    

}

