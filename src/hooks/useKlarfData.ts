import { useState, useCallback, useRef } from 'react';
import type {
  WaferInfo,
  DefectRecord,
  DieRecord,
  PackedDefectBuffer,
  PackedDieBuffer,
  DefectHoverInfo,
} from '../types';

let nativeModule: any = null;

async function loadNativeModule() {
  if (nativeModule) return nativeModule;
  try {
    nativeModule = require('wafermap-native');
    return nativeModule;
  } catch {
    console.warn('Native module not available via require, trying dynamic import');
  }
  try {
    nativeModule = await import('wafermap-native');
    return nativeModule;
  } catch {
    console.warn('Native module not available, using JS fallback');
    return null;
  }
}

export function useKlarfData() {
  const [defectData, setDefectData] = useState<PackedDefectBuffer | null>(null);
  const [dieData, setDieData] = useState<PackedDieBuffer | null>(null);
  const [waferInfo, setWaferInfo] = useState<WaferInfo | null>(null);
  const [defects, setDefects] = useState<DefectRecord[]>([]);
  const [dies, setDies] = useState<DieRecord[]>([]);
  const [hoveredDefect, setHoveredDefect] = useState<DefectHoverInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const loadKlarfFile = useCallback(async (filePath: string) => {
    setLoading(true);
    setProgress(0);
    setError(null);
    abortRef.current = false;

    try {
      const mod = await loadNativeModule();

      if (mod && filePath) {
        setProgress(5);

        if (mod.parseKlarfFileAsync) {
          const result = await mod.parseKlarfFileAsync(filePath, (p: { phase: string; percent: number }) => {
            if (!abortRef.current) {
              setProgress(p.percent);
            }
          });
          if (!abortRef.current) {
            setProgress(90);
            unpackSharedResult(result);
            setProgress(100);
          }
        } else if (mod.parseKlarfFileSync) {
          setProgress(10);
          const result = mod.parseKlarfFileSync(filePath);
          setProgress(90);
          unpackSharedResult(result);
          setProgress(100);
        }

        setLoading(false);
        return;
      }

      const demoData = generateDemoData();
      setProgress(80);
      applyDemoData(demoData);
      setProgress(100);
    } catch (err: any) {
      if (!abortRef.current) {
        setError(err.message || 'Failed to load KLARF file');
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const unpackSharedResult = (result: any) => {
    const info: WaferInfo = {
      waferId: result.waferInfo.waferId,
      diePitchX: result.waferInfo.diePitchX,
      diePitchY: result.waferInfo.diePitchY,
      dieOriginX: result.waferInfo.dieOriginX,
      dieOriginY: result.waferInfo.dieOriginY,
      centerX: result.waferInfo.centerX,
      centerY: result.waferInfo.centerY,
      diameter: result.waferInfo.diameter,
      totalDies: result.waferInfo.totalDies,
      totalDefects: result.waferInfo.totalDefects,
    };
    setWaferInfo(info);

    const positionsBuf = result.defectPositions;
    const positions = new Float32Array(
      positionsBuf.buffer,
      positionsBuf.byteOffset,
      result.defectCount * 2
    );

    const classesBuf = result.defectClasses;
    const classes = new Uint8Array(
      classesBuf.buffer,
      classesBuf.byteOffset,
      result.defectCount
    );

    const dieIdxBuf = result.defectDieIndices;
    const dieIndices = new Uint32Array(
      dieIdxBuf.buffer,
      dieIdxBuf.byteOffset,
      result.defectCount
    );

    setDefectData({ positions, classes, dieIndices, count: result.defectCount });

    const diePosBuf = result.diePositions;
    const diePositions = new Float32Array(
      diePosBuf.buffer,
      diePosBuf.byteOffset,
      result.dieCount * 2
    );

    const dieCountBuf = result.dieDefectCounts;
    const dieDefectCounts = new Uint32Array(
      dieCountBuf.buffer,
      dieCountBuf.byteOffset,
      result.dieCount
    );

    const dieStartBuf = result.dieDefectStarts;
    const dieDefectStarts = new Uint32Array(
      dieStartBuf.buffer,
      dieStartBuf.byteOffset,
      result.dieCount
    );

    setDieData({
      positions: diePositions,
      defectCounts: dieDefectCounts,
      defectStarts: dieDefectStarts,
      count: result.dieCount,
    });
  };

  const applyDemoData = (demo: ReturnType<typeof generateDemoData>) => {
    setWaferInfo(demo.waferInfo);
    setDefectData(demo.defectData);
    setDieData(demo.dieData);
    setDefects(demo.defects);
    setDies(demo.dies);
  };

  return {
    defectData,
    dieData,
    waferInfo,
    defects,
    dies,
    hoveredDefect,
    loading,
    progress,
    error,
    loadKlarfFile,
    setHoveredDefect,
  };
}

function generateDemoData() {
  const diameter = 300;
  const centerX = 0;
  const centerY = 0;
  const radius = diameter / 2;
  const pitchX = 10;
  const pitchY = 10;

  const waferInfo: WaferInfo = {
    waferId: 'DEMO-01',
    diePitchX: pitchX,
    diePitchY: pitchY,
    dieOriginX: -radius,
    dieOriginY: -radius,
    centerX,
    centerY,
    diameter,
    totalDies: 0,
    totalDefects: 0,
  };

  const dieList: DieRecord[] = [];
  const defectList: DefectRecord[] = [];

  const r2 = radius * radius;
  let globalDefectIdx = 0;

  for (let x = -radius + pitchX / 2; x < radius; x += pitchX) {
    for (let y = -radius + pitchY / 2; y < radius; y += pitchY) {
      const dist2 = x * x + y * y;
      if (dist2 > r2) continue;

      const dieX = Math.round((x - (-radius)) / pitchX);
      const dieY = Math.round((y - (-radius)) / pitchY);
      const dieIdx = dieList.length;

      const numDefects = Math.random() < 0.15 ? Math.floor(Math.random() * 8) + 1 : 0;
      const startIdx = globalDefectIdx;

      for (let d = 0; d < numDefects; d++) {
        const dx = (Math.random() - 0.5) * pitchX * 0.8;
        const dy = (Math.random() - 0.5) * pitchY * 0.8;
        defectList.push({
          defectId: globalDefectIdx,
          xRel: x + dx,
          yRel: y + dy,
          xIndex: dieX,
          yIndex: dieY,
          dieIndex: dieIdx,
          defectClass: Math.floor(Math.random() * 8),
          bin: Math.floor(Math.random() * 4),
          area: Math.random() * 50 + 1,
        });
        globalDefectIdx++;
      }

      dieList.push({
        dieX,
        dieY,
        defectCount: numDefects,
        defectStartIndex: startIdx,
      });
    }
  }

  waferInfo.totalDies = dieList.length;
  waferInfo.totalDefects = defectList.length;

  const positions = new Float32Array(defectList.length * 2);
  const classes = new Uint8Array(defectList.length);
  const dieIndices = new Uint32Array(defectList.length);

  for (let i = 0; i < defectList.length; i++) {
    positions[i * 2] = defectList[i].xRel;
    positions[i * 2 + 1] = defectList[i].yRel;
    classes[i] = defectList[i].defectClass;
    dieIndices[i] = defectList[i].dieIndex;
  }

  const defectData: PackedDefectBuffer = {
    positions,
    classes,
    dieIndices,
    count: defectList.length,
  };

  const diePositions = new Float32Array(dieList.length * 2);
  const dieDefectCounts = new Uint32Array(dieList.length);
  const dieDefectStarts = new Uint32Array(dieList.length);

  for (let i = 0; i < dieList.length; i++) {
    diePositions[i * 2] = dieList[i].dieX;
    diePositions[i * 2 + 1] = dieList[i].dieY;
    dieDefectCounts[i] = dieList[i].defectCount;
    dieDefectStarts[i] = dieList[i].defectStartIndex;
  }

  const dieData: PackedDieBuffer = {
    positions: diePositions,
    defectCounts: dieDefectCounts,
    defectStarts: dieDefectStarts,
    count: dieList.length,
  };

  return { waferInfo, defectData, dieData, defects: defectList, dies: dieList };
}
