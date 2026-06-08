import type { PackedDefectBuffer, PackedDieBuffer, WaferInfo, DefectHoverInfo, DefectRecord, DieRecord, ClusterInfo, ClusterResult } from '../types';

const DEFECT_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_position;
  attribute vec2 a_offset;
  attribute float a_class;
  attribute float a_size;
  attribute float a_dieIdx;

  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;
  uniform float u_pointScale;
  uniform vec2 u_waferCenter;
  uniform float u_waferRadius;

  varying float v_class;
  varying float v_dieIdx;
  varying vec2 v_worldPos;

  void main() {
    vec2 worldPos = a_offset;
    float dist = length(worldPos - u_waferCenter);
    if (dist > u_waferRadius) {
      gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }

    v_worldPos = worldPos;
    vec2 screenPos = (worldPos + u_pan) * u_zoom;
    vec2 clipPos = (screenPos / u_resolution) * 2.0 - 1.0;
    clipPos.y = -clipPos.y;

    gl_Position = vec4(clipPos + a_position * u_pointScale / u_resolution, 0.0, 1.0);
    gl_PointSize = max(1.0, u_pointScale * u_zoom / 10.0);
    v_class = a_class;
    v_dieIdx = a_dieIdx;
  }
`;

const DEFECT_FRAGMENT_SHADER = `
  precision highp float;

  varying float v_class;
  varying float v_dieIdx;
  varying vec2 v_worldPos;

  uniform sampler2D u_classColors;
  uniform float u_numClasses;
  uniform float u_hoveredDieIdx;
  uniform float u_selectedClass;
  uniform vec2 u_waferCenter;
  uniform float u_waferRadius;

  void main() {
    float dist = length(v_worldPos - u_waferCenter);
    if (dist > u_waferRadius) discard;

    float classIndex = v_class;
    vec2 texCoord = vec2((classIndex + 0.5) / u_numClasses, 0.5);
    vec4 color = texture2D(u_classColors, texCoord);

    if (u_selectedClass >= 0.0 && abs(v_class - u_selectedClass) > 0.5) {
      color.rgb *= 0.25;
      color.a = 0.4;
    }

    if (u_hoveredDieIdx >= 0.0 && abs(v_dieIdx - u_hoveredDieIdx) < 0.5) {
      color.rgb = mix(color.rgb, vec3(1.0), 0.5);
    }

    gl_FragColor = color;
  }
`;

const WAFER_OUTLINE_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_position;

  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;
  uniform vec2 u_waferCenter;
  uniform float u_waferRadius;

  void main() {
    vec2 worldPos = u_waferCenter + a_position * u_waferRadius;
    vec2 screenPos = (worldPos + u_pan) * u_zoom;
    vec2 clipPos = (screenPos / u_resolution) * 2.0 - 1.0;
    clipPos.y = -clipPos.y;
    gl_Position = vec4(clipPos, 0.0, 1.0);
  }
`;

const WAFER_OUTLINE_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec4 u_color;
  void main() {
    gl_FragColor = u_color;
  }
`;

const GRID_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_position;

  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;

  void main() {
    vec2 screenPos = (a_position + u_pan) * u_zoom;
    vec2 clipPos = (screenPos / u_resolution) * 2.0 - 1.0;
    clipPos.y = -clipPos.y;
    gl_Position = vec4(clipPos, 0.0, 1.0);
  }
`;

const GRID_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec4 u_color;
  void main() {
    gl_FragColor = u_color;
  }
`;

const CLUSTER_BBOX_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_position;

  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;

  void main() {
    vec2 screenPos = (a_position + u_pan) * u_zoom;
    vec2 clipPos = (screenPos / u_resolution) * 2.0 - 1.0;
    clipPos.y = -clipPos.y;
    gl_Position = vec4(clipPos, 0.0, 1.0);
  }
`;

const CLUSTER_BBOX_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec4 u_color;
  void main() {
    gl_FragColor = u_color;
  }
`;

const CLUSTER_MASK_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_position;
  attribute vec2 a_bboxMin;
  attribute vec2 a_bboxMax;
  attribute float a_isScratch;

  uniform vec2 u_resolution;
  uniform vec2 u_pan;
  uniform float u_zoom;

  varying vec2 v_localPos;
  varying float v_isScratch;

  void main() {
    vec2 worldPos = mix(a_bboxMin, a_bboxMax, a_position);
    vec2 screenPos = (worldPos + u_pan) * u_zoom;
    vec2 clipPos = (screenPos / u_resolution) * 2.0 - 1.0;
    clipPos.y = -clipPos.y;
    gl_Position = vec4(clipPos, 0.0, 1.0);
    v_localPos = a_position;
    v_isScratch = a_isScratch;
  }
`;

const CLUSTER_MASK_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_localPos;
  varying float v_isScratch;

  uniform float u_borderWidth;
  uniform vec4 u_scratchColor;
  uniform vec4 u_borderColor;

  void main() {
    float b = u_borderWidth;
    float isBorder = step(v_localPos.x, b) + step(1.0 - b, v_localPos.x)
                   + step(v_localPos.y, b) + step(1.0 - b, v_localPos.y);

    if (isBorder > 0.5) {
      gl_FragColor = u_borderColor;
    } else if (v_isScratch > 0.5) {
      gl_FragColor = u_scratchColor;
    } else {
      discard;
    }
  }
`;

const CLASS_COLORS: number[][] = [
  [1.0, 0.2, 0.2],
  [0.2, 1.0, 0.2],
  [0.2, 0.4, 1.0],
  [1.0, 1.0, 0.2],
  [1.0, 0.2, 1.0],
  [0.2, 1.0, 1.0],
  [1.0, 0.6, 0.2],
  [0.6, 0.2, 1.0],
  [0.2, 1.0, 0.6],
  [1.0, 0.4, 0.6],
  [0.4, 0.8, 0.2],
  [0.8, 0.2, 0.4],
  [0.2, 0.6, 0.8],
  [0.9, 0.9, 0.5],
  [0.5, 0.3, 0.8],
  [0.3, 0.7, 0.5],
];

export class WaferMapRenderer {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private width: number = 0;
  private height: number = 0;

  private defectProgram: WebGLProgram | null = null;
  private outlineProgram: WebGLProgram | null = null;
  private gridProgram: WebGLProgram | null = null;
  private clusterBboxProgram: WebGLProgram | null = null;
  private clusterMaskProgram: WebGLProgram | null = null;

  private defectVao: {
    positionBuffer: WebGLBuffer;
    offsetBuffer: WebGLBuffer;
    classBuffer: WebGLBuffer;
    sizeBuffer: WebGLBuffer;
    dieIdxBuffer: WebGLBuffer;
    count: number;
  } | null = null;

  private outlineBuffer: WebGLBuffer | null = null;
  private gridBuffer: WebGLBuffer | null = null;
  private gridCount: number = 0;
  private classColorTexture: WebGLTexture | null = null;

  private panX: number = 0;
  private panY: number = 0;
  private zoom: number = 1;
  private waferCenterX: number = 0;
  private waferCenterY: number = 0;
  private waferRadius: number = 150;

  private hoveredDieIdx: number = -1;
  private selectedClass: number = -1;

  private ext: ANGLE_instanced_arrays | null = null;

  private defectPositions: Float32Array = new Float32Array(0);
  private defectClasses: Uint8Array = new Uint8Array(0);
  private defectDieIndices: Uint32Array = new Uint32Array(0);

  private animationFrameId: number = 0;
  private needsRender: boolean = true;

  private clusterBboxBuffer: WebGLBuffer | null = null;
  private clusterBboxVertCount: number = 0;
  private clusterMaskVao: {
    positionBuffer: WebGLBuffer;
    bboxMinBuffer: WebGLBuffer;
    bboxMaxBuffer: WebGLBuffer;
    isScratchBuffer: WebGLBuffer;
    count: number;
  } | null = null;
  private clusters: ClusterInfo[] = [];
  private showClusters: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      throw new Error('WebGL not available');
    }
    this.gl = gl;

    const ext = gl.getExtension('ANGLE_instanced_arrays');
    if (!ext) {
      throw new Error('ANGLE_instanced_arrays extension not available');
    }
    this.ext = ext;

    this.initShaders();
    this.initClassColorTexture();
    this.initWaferOutline();
  }

  private initShaders(): void {
    this.defectProgram = this.createProgram(DEFECT_VERTEX_SHADER, DEFECT_FRAGMENT_SHADER);
    this.outlineProgram = this.createProgram(WAFER_OUTLINE_VERTEX_SHADER, WAFER_OUTLINE_FRAGMENT_SHADER);
    this.gridProgram = this.createProgram(GRID_VERTEX_SHADER, GRID_FRAGMENT_SHADER);
    this.clusterBboxProgram = this.createProgram(CLUSTER_BBOX_VERTEX_SHADER, CLUSTER_BBOX_FRAGMENT_SHADER);
    this.clusterMaskProgram = this.createProgram(CLUSTER_MASK_VERTEX_SHADER, CLUSTER_MASK_FRAGMENT_SHADER);
  }

  private initClassColorTexture(): void {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const data = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      const c = CLASS_COLORS[i % CLASS_COLORS.length];
      data[i * 4] = Math.floor(c[0] * 255);
      data[i * 4 + 1] = Math.floor(c[1] * 255);
      data[i * 4 + 2] = Math.floor(c[2] * 255);
      data[i * 4 + 3] = 220;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.classColorTexture = tex;
  }

  private initWaferOutline(): void {
    const gl = this.gl;
    this.outlineBuffer = gl.createBuffer();
    const segments = 128;
    const verts = new Float32Array((segments + 1) * 2);
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      verts[i * 2] = Math.cos(angle);
      verts[i * 2 + 1] = Math.sin(angle);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.outlineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }
    return shader;
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      throw new Error(`Program link error: ${info}`);
    }
    return program;
  }

  setWaferInfo(info: WaferInfo): void {
    this.waferCenterX = info.centerX;
    this.waferCenterY = info.centerY;
    this.waferRadius = info.diameter / 2;

    this.panX = -info.centerX;
    this.panY = -info.centerY;

    const minDim = Math.min(this.width, this.height);
    if (minDim > 0) {
      this.zoom = (minDim * 0.85) / info.diameter;
    }

    this.buildGrid(info);
    this.needsRender = true;
  }

  private buildGrid(info: WaferInfo): void {
    const gl = this.gl;
    const gridVerts: number[] = [];

    const halfDiam = info.diameter / 2;
    const r2 = halfDiam * halfDiam;
    const pitchX = info.diePitchX || 10;
    const pitchY = info.diePitchY || 10;

    const startX = info.dieOriginX - halfDiam;
    const endX = info.dieOriginX + halfDiam;
    const startY = info.dieOriginY - halfDiam;
    const endY = info.dieOriginY + halfDiam;

    for (let x = startX; x <= endX; x += pitchX) {
      const cx = x - info.centerX;
      const maxDy = Math.sqrt(Math.max(0, r2 - cx * cx));
      gridVerts.push(x, info.centerY - maxDy, x, info.centerY + maxDy);
    }

    for (let y = startY; y <= endY; y += pitchY) {
      const cy = y - info.centerY;
      const maxDx = Math.sqrt(Math.max(0, r2 - cy * cy));
      gridVerts.push(info.centerX - maxDx, y, info.centerX + maxDx, y);
    }

    this.gridCount = gridVerts.length / 2;
    if (this.gridBuffer) gl.deleteBuffer(this.gridBuffer);
    this.gridBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridVerts), gl.STATIC_DRAW);
  }

  setDefectData(
    positions: Float32Array,
    classes: Uint8Array,
    dieIndices: Uint32Array,
    count: number
  ): void {
    const gl = this.gl;

    this.defectPositions = positions;
    this.defectClasses = classes;
    this.defectDieIndices = dieIndices;

    if (this.defectVao) {
      gl.deleteBuffer(this.defectVao.positionBuffer);
      gl.deleteBuffer(this.defectVao.offsetBuffer);
      gl.deleteBuffer(this.defectVao.classBuffer);
      gl.deleteBuffer(this.defectVao.sizeBuffer);
      gl.deleteBuffer(this.defectVao.dieIdxBuffer);
    }

    const positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);

    const offsetBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const classBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, classBuffer);
    const classFloats = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      classFloats[i] = classes[i];
    }
    gl.bufferData(gl.ARRAY_BUFFER, classFloats, gl.STATIC_DRAW);

    const sizeBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    const sizes = new Float32Array(count).fill(3.0);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);

    const dieIdxBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, dieIdxBuffer);
    const dieIdxFloats = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      dieIdxFloats[i] = dieIndices[i];
    }
    gl.bufferData(gl.ARRAY_BUFFER, dieIdxFloats, gl.STATIC_DRAW);

    this.defectVao = {
      positionBuffer,
      offsetBuffer,
      classBuffer,
      sizeBuffer,
      dieIdxBuffer,
      count,
    };

    this.needsRender = true;
  }

  setHoveredDie(dieIdx: number): void {
    if (this.hoveredDieIdx !== dieIdx) {
      this.hoveredDieIdx = dieIdx;
      this.needsRender = true;
    }
  }

  setSelectedClass(classCode: number): void {
    if (this.selectedClass !== classCode) {
      this.selectedClass = classCode;
      this.needsRender = true;
    }
  }

  setClusterData(clusters: ClusterInfo[]): void {
    this.clusters = clusters;
    this.uploadClusterBuffers();
    this.needsRender = true;
  }

  setShowClusters(show: boolean): void {
    if (this.showClusters !== show) {
      this.showClusters = show;
      this.needsRender = true;
    }
  }

  private uploadClusterBuffers(): void {
    const gl = this.gl;

    if (this.clusterBboxBuffer) {
      gl.deleteBuffer(this.clusterBboxBuffer);
      this.clusterBboxBuffer = null;
    }
    if (this.clusterMaskVao) {
      gl.deleteBuffer(this.clusterMaskVao.positionBuffer);
      gl.deleteBuffer(this.clusterMaskVao.bboxMinBuffer);
      gl.deleteBuffer(this.clusterMaskVao.bboxMaxBuffer);
      gl.deleteBuffer(this.clusterMaskVao.isScratchBuffer);
      this.clusterMaskVao = null;
    }

    if (this.clusters.length === 0) return;

    const pad = 2.0;
    const bboxVerts: number[] = [];
    for (const c of this.clusters) {
      const x0 = c.bbox.minX - pad;
      const y0 = c.bbox.minY - pad;
      const x1 = c.bbox.maxX + pad;
      const y1 = c.bbox.maxY + pad;
      bboxVerts.push(x0, y0, x1, y0, x1, y1, x0, y1, x0, y0);
    }
    this.clusterBboxVertCount = bboxVerts.length / 2;
    this.clusterBboxBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.clusterBboxBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bboxVerts), gl.STATIC_DRAW);

    const quadVerts = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const bboxMinData = new Float32Array(this.clusters.length * 2);
    const bboxMaxData = new Float32Array(this.clusters.length * 2);
    const isScratchData = new Float32Array(this.clusters.length);

    for (let i = 0; i < this.clusters.length; i++) {
      const c = this.clusters[i];
      bboxMinData[i * 2] = c.bbox.minX - pad;
      bboxMinData[i * 2 + 1] = c.bbox.minY - pad;
      bboxMaxData[i * 2] = c.bbox.maxX + pad;
      bboxMaxData[i * 2 + 1] = c.bbox.maxY + pad;
      isScratchData[i] = c.isScratch ? 1.0 : 0.0;
    }

    const positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    const bboxMinBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bboxMinBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, bboxMinData, gl.STATIC_DRAW);

    const bboxMaxBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bboxMaxBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, bboxMaxData, gl.STATIC_DRAW);

    const isScratchBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, isScratchBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, isScratchData, gl.STATIC_DRAW);

    this.clusterMaskVao = {
      positionBuffer,
      bboxMinBuffer,
      bboxMaxBuffer,
      isScratchBuffer,
      count: this.clusters.length,
    };
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.width = width * dpr;
    this.height = height * dpr;
    this.gl.viewport(0, 0, this.width, this.height);
    this.needsRender = true;
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx / this.zoom;
    this.panY += dy / this.zoom;
    this.needsRender = true;
  }

  zoomAt(factor: number, cx: number, cy: number): void {
    const dpr = window.devicePixelRatio || 1;
    const px = cx * dpr;
    const py = cy * dpr;

    const worldX = px / this.zoom - this.panX;
    const worldY = py / this.zoom - this.panY;

    this.zoom *= factor;
    this.zoom = Math.max(0.01, Math.min(this.zoom, 1000));

    this.panX = px / this.zoom - worldX;
    this.panY = py / this.zoom - worldY;
    this.needsRender = true;
  }

  fitToView(): void {
    const minDim = Math.min(this.width, this.height);
    if (minDim > 0 && this.waferRadius > 0) {
      this.zoom = (minDim * 0.85) / (this.waferRadius * 2);
      this.panX = -this.waferCenterX;
      this.panY = -this.waferCenterY;
    }
    this.needsRender = true;
  }

  pickDefect(screenX: number, screenY: number): number {
    if (!this.defectPositions || this.defectPositions.length === 0) return -1;

    const dpr = window.devicePixelRatio || 1;
    const px = screenX * dpr;
    const py = screenY * dpr;

    const worldX = px / this.zoom - this.panX;
    const worldY = py / this.zoom - this.panY;

    const count = this.defectPositions.length / 2;
    const pickRadius = 5 / this.zoom;

    let bestIdx = -1;
    let bestDist = pickRadius * pickRadius;

    for (let i = 0; i < count; i++) {
      const dx = this.defectPositions[i * 2] - worldX;
      const dy = this.defectPositions[i * 2 + 1] - worldY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  getDefectWorldPos(index: number): { x: number; y: number } | null {
    if (index < 0 || index * 2 + 1 >= this.defectPositions.length) return null;
    return {
      x: this.defectPositions[index * 2],
      y: this.defectPositions[index * 2 + 1],
    };
  }

  render(): void {
    const gl = this.gl;
    gl.clearColor(0.039, 0.055, 0.09, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.renderGrid();
    this.renderWaferOutline();
    this.renderDefects();
    if (this.showClusters) {
      this.renderClusterOverlay();
    }
  }

  private renderGrid(): void {
    if (!this.gridProgram || !this.gridBuffer || this.gridCount === 0) return;
    const gl = this.gl;
    const prog = this.gridProgram;

    gl.useProgram(prog);

    const aPos = gl.getAttribLocation(prog, 'a_position');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uPan = gl.getUniformLocation(prog, 'u_pan');
    const uZoom = gl.getUniformLocation(prog, 'u_zoom');
    const uColor = gl.getUniformLocation(prog, 'u_color');

    gl.uniform2f(uRes, this.width, this.height);
    gl.uniform2f(uPan, this.panX, this.panY);
    gl.uniform1f(uZoom, this.zoom);
    gl.uniform4f(uColor, 0.15, 0.2, 0.3, 0.3);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINES, 0, this.gridCount);
    gl.disableVertexAttribArray(aPos);
  }

  private renderWaferOutline(): void {
    if (!this.outlineProgram || !this.outlineBuffer) return;
    const gl = this.gl;
    const prog = this.outlineProgram;

    gl.useProgram(prog);

    const aPos = gl.getAttribLocation(prog, 'a_position');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uPan = gl.getUniformLocation(prog, 'u_pan');
    const uZoom = gl.getUniformLocation(prog, 'u_zoom');
    const uCenter = gl.getUniformLocation(prog, 'u_waferCenter');
    const uRadius = gl.getUniformLocation(prog, 'u_waferRadius');
    const uColor = gl.getUniformLocation(prog, 'u_color');

    gl.uniform2f(uRes, this.width, this.height);
    gl.uniform2f(uPan, this.panX, this.panY);
    gl.uniform1f(uZoom, this.zoom);
    gl.uniform2f(uCenter, this.waferCenterX, this.waferCenterY);
    gl.uniform1f(uRadius, this.waferRadius);
    gl.uniform4f(uColor, 0.3, 0.5, 0.8, 0.8);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.outlineBuffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINE_STRIP, 0, 129);
    gl.disableVertexAttribArray(aPos);
  }

  private renderDefects(): void {
    if (!this.defectProgram || !this.defectVao || !this.ext) return;
    const gl = this.gl;
    const ext = this.ext;
    const prog = this.defectProgram;
    const vao = this.defectVao;

    gl.useProgram(prog);

    const aPosition = gl.getAttribLocation(prog, 'a_position');
    const aOffset = gl.getAttribLocation(prog, 'a_offset');
    const aClass = gl.getAttribLocation(prog, 'a_class');
    const aSize = gl.getAttribLocation(prog, 'a_size');
    const aDieIdx = gl.getAttribLocation(prog, 'a_dieIdx');

    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uPan = gl.getUniformLocation(prog, 'u_pan');
    const uZoom = gl.getUniformLocation(prog, 'u_zoom');
    const uPointScale = gl.getUniformLocation(prog, 'u_pointScale');
    const uCenter = gl.getUniformLocation(prog, 'u_waferCenter');
    const uRadius = gl.getUniformLocation(prog, 'u_waferRadius');
    const uClassColors = gl.getUniformLocation(prog, 'u_classColors');
    const uNumClasses = gl.getUniformLocation(prog, 'u_numClasses');
    const uHoveredDie = gl.getUniformLocation(prog, 'u_hoveredDieIdx');
    const uSelClass = gl.getUniformLocation(prog, 'u_selectedClass');

    gl.uniform2f(uRes, this.width, this.height);
    gl.uniform2f(uPan, this.panX, this.panY);
    gl.uniform1f(uZoom, this.zoom);
    gl.uniform1f(uPointScale, 3.0);
    gl.uniform2f(uCenter, this.waferCenterX, this.waferCenterY);
    gl.uniform1f(uRadius, this.waferRadius);
    gl.uniform1i(uClassColors, 0);
    gl.uniform1f(uNumClasses, 256.0);
    gl.uniform1f(uHoveredDie, this.hoveredDieIdx);
    gl.uniform1f(uSelClass, this.selectedClass);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.classColorTexture);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.positionBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.offsetBuffer);
    gl.enableVertexAttribArray(aOffset);
    gl.vertexAttribPointer(aOffset, 2, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aOffset, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.classBuffer);
    gl.enableVertexAttribArray(aClass);
    gl.vertexAttribPointer(aClass, 1, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aClass, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.sizeBuffer);
    gl.enableVertexAttribArray(aSize);
    gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aSize, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.dieIdxBuffer);
    gl.enableVertexAttribArray(aDieIdx);
    gl.vertexAttribPointer(aDieIdx, 1, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aDieIdx, 1);

    ext.drawArraysInstancedANGLE(gl.TRIANGLE_FAN, 0, 4, vao.count);

    ext.vertexAttribDivisorANGLE(aOffset, 0);
    ext.vertexAttribDivisorANGLE(aClass, 0);
    ext.vertexAttribDivisorANGLE(aSize, 0);
    ext.vertexAttribDivisorANGLE(aDieIdx, 0);

    gl.disableVertexAttribArray(aPosition);
    gl.disableVertexAttribArray(aOffset);
    gl.disableVertexAttribArray(aClass);
    gl.disableVertexAttribArray(aSize);
    gl.disableVertexAttribArray(aDieIdx);
  }

  private renderClusterOverlay(): void {
    if (this.clusters.length === 0) return;
    const gl = this.gl;
    const ext = this.ext;

    this.renderClusterMasks(gl, ext);
    this.renderClusterBboxes(gl);
  }

  private renderClusterMasks(gl: WebGLRenderingContext, ext: ANGLE_instanced_arrays): void {
    if (!this.clusterMaskProgram || !this.clusterMaskVao) return;
    const prog = this.clusterMaskProgram;
    const vao = this.clusterMaskVao;

    gl.useProgram(prog);

    const aPosition = gl.getAttribLocation(prog, 'a_position');
    const aBboxMin = gl.getAttribLocation(prog, 'a_bboxMin');
    const aBboxMax = gl.getAttribLocation(prog, 'a_bboxMax');
    const aIsScratch = gl.getAttribLocation(prog, 'a_isScratch');

    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uPan = gl.getUniformLocation(prog, 'u_pan');
    const uZoom = gl.getUniformLocation(prog, 'u_zoom');
    const uBorderWidth = gl.getUniformLocation(prog, 'u_borderWidth');
    const uScratchColor = gl.getUniformLocation(prog, 'u_scratchColor');
    const uBorderColor = gl.getUniformLocation(prog, 'u_borderColor');

    gl.uniform2f(uRes, this.width, this.height);
    gl.uniform2f(uPan, this.panX, this.panY);
    gl.uniform1f(uZoom, this.zoom);
    gl.uniform1f(uBorderWidth, 0.03);
    gl.uniform4f(uScratchColor, 1.0, 0.1, 0.1, 0.18);
    gl.uniform4f(uBorderColor, 1.0, 0.3, 0.1, 0.9);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.positionBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.bboxMinBuffer);
    gl.enableVertexAttribArray(aBboxMin);
    gl.vertexAttribPointer(aBboxMin, 2, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aBboxMin, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.bboxMaxBuffer);
    gl.enableVertexAttribArray(aBboxMax);
    gl.vertexAttribPointer(aBboxMax, 2, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aBboxMax, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.isScratchBuffer);
    gl.enableVertexAttribArray(aIsScratch);
    gl.vertexAttribPointer(aIsScratch, 1, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(aIsScratch, 1);

    ext.drawArraysInstancedANGLE(gl.TRIANGLE_FAN, 0, 4, vao.count);

    ext.vertexAttribDivisorANGLE(aBboxMin, 0);
    ext.vertexAttribDivisorANGLE(aBboxMax, 0);
    ext.vertexAttribDivisorANGLE(aIsScratch, 0);

    gl.disableVertexAttribArray(aPosition);
    gl.disableVertexAttribArray(aBboxMin);
    gl.disableVertexAttribArray(aBboxMax);
    gl.disableVertexAttribArray(aIsScratch);
  }

  private renderClusterBboxes(gl: WebGLRenderingContext): void {
    if (!this.clusterBboxProgram || !this.clusterBboxBuffer || this.clusterBboxVertCount === 0) return;
    const prog = this.clusterBboxProgram;

    gl.useProgram(prog);

    const aPos = gl.getAttribLocation(prog, 'a_position');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uPan = gl.getUniformLocation(prog, 'u_pan');
    const uZoom = gl.getUniformLocation(prog, 'u_zoom');
    const uColor = gl.getUniformLocation(prog, 'u_color');

    gl.uniform2f(uRes, this.width, this.height);
    gl.uniform2f(uPan, this.panX, this.panY);
    gl.uniform1f(uZoom, this.zoom);

    let clusterIdx = 0;
    for (const c of this.clusters) {
      if (c.isScratch) {
        gl.uniform4f(uColor, 1.0, 0.2, 0.2, 0.95);
      } else {
        gl.uniform4f(uColor, 0.3, 0.7, 1.0, 0.6);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this.clusterBboxBuffer);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const startVert = clusterIdx * 5;
      gl.drawArrays(gl.LINE_STRIP, startVert, 5);
      clusterIdx++;
    }

    gl.disableVertexAttribArray(aPos);
  }

  startRenderLoop(): void {
    const loop = () => {
      if (this.needsRender) {
        this.render();
        this.needsRender = false;
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  stopRenderLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  destroy(): void {
    this.stopRenderLoop();
    const gl = this.gl;

    if (this.defectVao) {
      gl.deleteBuffer(this.defectVao.positionBuffer);
      gl.deleteBuffer(this.defectVao.offsetBuffer);
      gl.deleteBuffer(this.defectVao.classBuffer);
      gl.deleteBuffer(this.defectVao.sizeBuffer);
      gl.deleteBuffer(this.defectVao.dieIdxBuffer);
    }

    if (this.outlineBuffer) gl.deleteBuffer(this.outlineBuffer);
    if (this.gridBuffer) gl.deleteBuffer(this.gridBuffer);
    if (this.clusterBboxBuffer) gl.deleteBuffer(this.clusterBboxBuffer);
    if (this.clusterMaskVao) {
      gl.deleteBuffer(this.clusterMaskVao.positionBuffer);
      gl.deleteBuffer(this.clusterMaskVao.bboxMinBuffer);
      gl.deleteBuffer(this.clusterMaskVao.bboxMaxBuffer);
      gl.deleteBuffer(this.clusterMaskVao.isScratchBuffer);
    }
    if (this.classColorTexture) gl.deleteTexture(this.classColorTexture);
    if (this.defectProgram) gl.deleteProgram(this.defectProgram);
    if (this.outlineProgram) gl.deleteProgram(this.outlineProgram);
    if (this.gridProgram) gl.deleteProgram(this.gridProgram);
    if (this.clusterBboxProgram) gl.deleteProgram(this.clusterBboxProgram);
    if (this.clusterMaskProgram) gl.deleteProgram(this.clusterMaskProgram);
  }
}

interface ANGLE_instanced_arrays {
  vertexAttribDivisorANGLE(index: number, divisor: number): void;
  drawArraysInstancedANGLE(mode: number, first: number, count: number, primcount: number): void;
  drawElementsInstancedANGLE(mode: number, count: number, type: number, offset: number, primcount: number): void;
  VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE: number;
}
