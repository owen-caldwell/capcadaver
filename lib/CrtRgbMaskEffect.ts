import { Effect, BlendFunction } from "postprocessing";
import { Uniform } from "three";

/**
 * CRT-style RGB subpixel grille + horizontal roll + scanline pulse.
 * Ported from three.js WGSL/TSL demo (Xor / https://mini.gmshaders.com/p/gm-shaders-mini-crt).
 */
const fragmentShader = `
uniform float cellSize;
uniform float cellOffset;
uniform float borderMask;
uniform float pulseIntensity;
uniform float pulseWidth;
uniform float pulseRate;
uniform float rollSpeed;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 dimensions = resolution;
  vec2 pixel = uv * dimensions;
  float cs = max(cellSize, 1.0);
  vec2 coord = pixel / cs;
  vec2 subCoord = coord * vec2(3.0, 1.0);
  vec2 cellOff = vec2(0.0, fract(floor(coord.x) * cellOffset));
  vec2 maskCoord = floor(coord + cellOff) * cs;
  vec2 samplePoint = maskCoord / dimensions;
  samplePoint.x = fract(samplePoint.x + fract(time * rollSpeed / 20.0));
  samplePoint.y = clamp(samplePoint.y, 0.0, 1.0);
  vec3 color = texture2D(inputBuffer, samplePoint).rgb;

  float ind = mod(floor(subCoord.x), 3.0);
  vec3 maskColor = vec3(
    float(ind < 0.5),
    float(ind >= 0.5 && ind < 1.5),
    float(ind >= 1.5)
  ) * 3.0;

  vec2 subCoordOffset = fract(subCoord + cellOff);
  vec2 cellUV = subCoordOffset * 2.0 - 1.0;
  vec2 border = 1.0 - cellUV * cellUV * borderMask;
  float borderClamp = clamp(border.x, 0.0, 1.0) * clamp(border.y, 0.0, 1.0);
  maskColor *= borderClamp;

  color *= maskColor;

  float pulse = sin(pixel.y / max(pulseWidth, 1.0) + time * pulseRate) * pulseIntensity;
  color *= 1.0 + pulse;

  outputColor = vec4(color, inputColor.a);
}
`;

export type CrtRgbMaskEffectOptions = {
  blendFunction?: BlendFunction;
  cellSize?: number;
  cellOffset?: number;
  borderMask?: number;
  pulseIntensity?: number;
  pulseWidth?: number;
  pulseRate?: number;
  rollSpeed?: number;
};

export class CrtRgbMaskEffect extends Effect {
  constructor({
    blendFunction = BlendFunction.SRC,
    cellSize = 5,
    cellOffset = 0.5,
    borderMask = 1.1,
    pulseIntensity = 0.07,
    pulseWidth = 56,
    pulseRate = 19,
    rollSpeed = 1.1,
  }: CrtRgbMaskEffectOptions = {}) {
    super("CrtRgbMaskEffect", fragmentShader, {
      blendFunction,
      uniforms: new Map([
        ["cellSize", new Uniform(cellSize)],
        ["cellOffset", new Uniform(cellOffset)],
        ["borderMask", new Uniform(borderMask)],
        ["pulseIntensity", new Uniform(pulseIntensity)],
        ["pulseWidth", new Uniform(pulseWidth)],
        ["pulseRate", new Uniform(pulseRate)],
        ["rollSpeed", new Uniform(rollSpeed)],
      ]),
    });
  }
}
