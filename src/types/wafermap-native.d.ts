declare module 'wafermap-native' {
  export interface JsWaferInfo {
    waferId: string;
    diePitchX: number;
    diePitchY: number;
    dieOriginX: number;
    dieOriginY: number;
    centerX: number;
    centerY: number;
    diameter: number;
    totalDies: number;
    totalDefects: number;
  }

  export interface JsSharedKlarfResult {
    waferInfo: JsWaferInfo;
    defectPositions: Uint8Array;
    defectClasses: Uint8Array;
    defectDieIndices: Uint8Array;
    defectCount: number;
    diePositions: Uint8Array;
    dieDefectCounts: Uint8Array;
    dieDefectStarts: Uint8Array;
    dieCount: number;
  }

  export interface JsClusterBBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  export interface JsClusterInfo {
    clusterId: number;
    pointCount: number;
    bbox: JsClusterBBox;
    isScratch: boolean;
    linearity: number;
    angleDeg: number;
  }

  export interface JsClusterResult {
    defectClusterIds: Int32Array;
    clusters: JsClusterInfo[];
    scratchCount: number;
  }

  export function parseKlarfFileSync(path: string): JsSharedKlarfResult;
  export function parseKlarfBufferSync(buffer: Uint8Array): JsSharedKlarfResult;
  export function parseKlarfFileAsync(
    path: string,
    onProgress: (progress: { phase: string; percent: number }) => void
  ): Promise<JsSharedKlarfResult>;
  export function runSpatialClustering(
    defectPositions: Float64Array,
    eps: number,
    minPoints: number
  ): JsClusterResult;
}
