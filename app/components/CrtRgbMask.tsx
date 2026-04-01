"use client";

import { wrapEffect } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { CrtRgbMaskEffect } from "@/lib/CrtRgbMaskEffect";

export const CrtRgbMask = wrapEffect(CrtRgbMaskEffect, {
  blendFunction: BlendFunction.SRC,
  cellSize: 5,
  cellOffset: 0.5,
  borderMask: 1.1,
  pulseIntensity: 0.07,
  pulseWidth: 56,
  pulseRate: 19,
  rollSpeed: 1.1,
});
