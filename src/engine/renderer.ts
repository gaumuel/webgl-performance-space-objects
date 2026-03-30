import { mat4 } from 'gl-matrix';

const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec4 aColor;
  attribute float aSize;
  attribute float aType; // 0: Square, 1: Circle, 2: Triangle, 3: Cube

  uniform mat4 uProjectionMatrix;
  uniform mat4 uViewMatrix;

  varying vec4 vColor;
  varying float vType;
  varying vec2 vCoord;

  void main() {
    vColor = aColor;
    vType = aType;
    
    // We use gl_PointSize to render sprites as points for maximum performance
    gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
    gl_PointSize = aSize * (800.0 / gl_Position.w); // Perspective sizing
    
    vCoord = vec2(0.0); // Not used for points, but good for expansion
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec4 vColor;
  varying float vType;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);

    if (vType < 0.5) { // Square
      // No discard needed for square
    } else if (vType < 1.5) { // Circle
      if (dist > 0.5) discard;
    } else if (vType < 2.5) { // Triangle
      if (coord.y > 0.4 || abs(coord.x) > (0.4 - coord.y) * 0.8) discard;
    } else if (vType < 3.5) { // Cube
      vec2 p = coord * 2.0;
      float hex = max(abs(p.x) * 1.1547, abs(p.x) * 0.57735 + abs(p.y));
      if (hex > 1.0) discard;
      
      if (p.y < -0.57735 * abs(p.x)) {
        gl_FragColor = vec4(vColor.rgb * 1.2, vColor.a);
      } else if (p.x < 0.0) {
        gl_FragColor = vec4(vColor.rgb * 0.6, vColor.a);
      } else {
        gl_FragColor = vec4(vColor.rgb * 0.8, vColor.a);
      }
      return;
    }

    gl_FragColor = vColor;
  }
`;

export class WebGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffers: {
    position: WebGLBuffer;
    color: WebGLBuffer;
    size: WebGLBuffer;
    type: WebGLBuffer;
  };
  private attribs: any;
  private uniforms: any;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { antialias: true });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    this.gl.useProgram(this.program);

    this.buffers = {
      position: gl.createBuffer()!,
      color: gl.createBuffer()!,
      size: gl.createBuffer()!,
      type: gl.createBuffer()!,
    };

    this.attribs = {
      position: gl.getAttribLocation(this.program, 'aPosition'),
      color: gl.getAttribLocation(this.program, 'aColor'),
      size: gl.getAttribLocation(this.program, 'aSize'),
      type: gl.getAttribLocation(this.program, 'aType'),
    };

    this.uniforms = {
      projection: gl.getUniformLocation(this.program, 'uProjectionMatrix'),
      view: gl.getUniformLocation(this.program, 'uViewMatrix'),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(this.gl.getShaderInfoLog(shader));
      throw new Error('Shader compile error');
    }
    return shader;
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const vs = this.createShader(this.gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);
    return program;
  }

  render(
    positions: Float32Array,
    colors: Float32Array,
    sizes: Float32Array,
    types: Float32Array,
    count: number,
    viewMatrix: mat4,
    projectionMatrix: mat4
  ) {
    const gl = this.gl;
    gl.clearColor(0.05, 0.05, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);

    gl.uniformMatrix4fv(this.uniforms.projection, false, projectionMatrix);
    gl.uniformMatrix4fv(this.uniforms.view, false, viewMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, positions.subarray(0, count * 3), gl.STREAM_DRAW);
    gl.vertexAttribPointer(this.attribs.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, colors.subarray(0, count * 4), gl.STREAM_DRAW);
    gl.vertexAttribPointer(this.attribs.color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.color);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.size);
    gl.bufferData(gl.ARRAY_BUFFER, sizes.subarray(0, count), gl.STREAM_DRAW);
    gl.vertexAttribPointer(this.attribs.size, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.size);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.type);
    gl.bufferData(gl.ARRAY_BUFFER, types.subarray(0, count), gl.STREAM_DRAW);
    gl.vertexAttribPointer(this.attribs.type, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.type);

    gl.drawArrays(gl.POINTS, 0, count);
  }
}
