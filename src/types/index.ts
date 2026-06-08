export interface WaferInfo {
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

export interface DieRecord {
  dieX: number;
  dieY: number;
  defectCount: number;
  defectStartIndex: number;
}

export interface DefectRecord {
  defectId: number;
  xRel: number;
  yRel: number;
  xIndex: number;
  yIndex: number;
  dieIndex: number;
  defectClass: number;
  bin: number;
  area: number;
}

export interface KlarfResult {
  waferInfo: WaferInfo;
  dies: DieRecord[];
  defects: DefectRecord[];
}

export interface DefectHoverInfo {
  defectId: number;
  xRel: number;
  yRel: number;
  dieX: number;
  dieY: number;
  defectClass: number;
  bin: number;
  area: number;
}

export interface PackedDefectBuffer {
  positions: Float32Array;
  classes: Uint8Array;
  dieIndices: Uint32Array;
  count: number;
}

export interface PackedDieBuffer {
  positions: Float32Array;
  defectCounts: Uint32Array;
  defectStarts: Uint32Array;
  count: number;
}

export interface ClusterBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ClusterInfo {
  clusterId: number;
  pointCount: number;
  bbox: ClusterBBox;
  isScratch: boolean;
  linearity: number;
  angleDeg: number;
}

export interface ClusterResult {
  defectClusterIds: Int32Array;
  clusters: ClusterInfo[];
  scratchCount: number;
}
