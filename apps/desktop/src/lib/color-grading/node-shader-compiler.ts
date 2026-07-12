import { PrimaryWheels, PrimarySliders } from '@open-factory/editor-core';
import type { ColorGradingGraph } from '@open-factory/editor-core';

type ColorGradingNode = ColorGradingGraph['nodes'][number];

/** Result of compiling a color grading node chain to GLSL. */
export interface CompiledColorGradingShader {
  /** Function definitions and uniform declarations (placed before main). */
  preamble: string;
  /** Per-node function calls operating on a `vec4 color` variable (placed inside main). */
  calls: string;
}

/**
 * Compile a color grading node chain into GLSL fragment shader pieces.
 *
 * - `preamble` contains function definitions and uniform declarations
 *   and should be placed **before** `void main()`.
 * - `calls` contains per-node invocations that operate on a `vec4 color`
 *   variable and should be placed **inside** `void main()`.
 */
export function compileColorGradingShader(nodes: ColorGradingNode[]): CompiledColorGradingShader {
  if (nodes.length === 0) {
    return { preamble: '', calls: '' };
  }

  const functions: string[] = [];
  const uniforms: string[] = [];
  const calls: string[] = [];

  const hasWheel = nodes.some(n => n.type === 'primary-wheel');
  const hasSlider = nodes.some(n => n.type === 'primary-slider');

  if (hasWheel) {
    functions.push(PrimaryWheels.generateGlslFunction());
  }
  if (hasSlider) {
    functions.push(PrimarySliders.generateGlslFunction());
  }

  for (const node of nodes) {
    const prefix = `cg_${node.id.replace(/-/g, '_')}`;

    if (node.type === 'primary-wheel') {
      uniforms.push(`uniform vec4 ${prefix}_lift;`);
      uniforms.push(`uniform vec4 ${prefix}_gamma;`);
      uniforms.push(`uniform vec4 ${prefix}_gain;`);
      uniforms.push(`uniform vec4 ${prefix}_offset;`);
      calls.push(PrimaryWheels.toGlslSnippet(prefix));
    } else if (node.type === 'primary-slider') {
      uniforms.push(`uniform float ${prefix}_temperature;`);
      uniforms.push(`uniform float ${prefix}_tint;`);
      uniforms.push(`uniform float ${prefix}_contrast;`);
      uniforms.push(`uniform float ${prefix}_pivot;`);
      uniforms.push(`uniform float ${prefix}_saturation;`);
      uniforms.push(`uniform float ${prefix}_hue;`);
      calls.push(PrimarySliders.toGlslSnippet(prefix));
    }
  }

  const preamble = [...functions, '', ...uniforms].join('\n');
  const callsCode = calls.join('\n');

  return { preamble, calls: callsCode };
}
