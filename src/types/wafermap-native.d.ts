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

  export function parseKlarfFileSync(path: string): JsSharedKlarfResult;
  export function parseKlarfBufferSync(buffer: Uint8Array): JsSharedKlarfResult;
  export function parseKlarfFileAsync(
    path: string,
    onProgress: (progress: { phase: string; percent: number }) => void
  ): Promise<JsSharedKlarfResult>;
}
