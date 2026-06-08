mod klarf;
mod parser;
mod buffer;

#[cfg(test)]
mod parser_test;

use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi(object)]
pub struct JsWaferInfo {
  pub wafer_id: String,
  pub die_pitch_x: f64,
  pub die_pitch_y: f64,
  pub die_origin_x: f64,
  pub die_origin_y: f64,
  pub center_x: f64,
  pub center_y: f64,
  pub diameter: f64,
  pub total_dies: u32,
  pub total_defects: u32,
}

#[napi(object)]
pub struct JsKlarfResult {
  pub wafer_info: JsWaferInfo,
  pub defect_positions: Buffer,
  pub defect_classes: Buffer,
  pub defect_die_indices: Buffer,
  pub defect_count: u32,
  pub die_positions: Buffer,
  pub die_defect_counts: Buffer,
  pub die_defect_starts: Buffer,
  pub die_count: u32,
}

#[napi]
pub fn parse_klarf_file(path: String) -> napi::Result<JsKlarfResult> {
  let data = parser::parse_klarf(&path)
    .map_err(|e| napi::Error::from_reason(format!("KLARF parse error: {}", e)))?;

  let info = &data.wafer_info;
  let js_info = JsWaferInfo {
    wafer_id: info.wafer_id.clone(),
    die_pitch_x: info.die_pitch_x,
    die_pitch_y: info.die_pitch_y,
    die_origin_x: info.die_origin_x,
    die_origin_y: info.die_origin_y,
    center_x: info.center_x,
    center_y: info.center_y,
    diameter: info.diameter,
    total_dies: data.dies.len() as u32,
    total_defects: data.defects.len() as u32,
  };

  let defect_buf = buffer::pack_defects(&data.defects);
  let die_buf = buffer::pack_dies(&data.dies);

  Ok(JsKlarfResult {
    wafer_info: js_info,
    defect_positions: Buffer::from(defect_buf.positions),
    defect_classes: Buffer::from(defect_buf.classes),
    defect_die_indices: Buffer::from(defect_buf.die_indices),
    defect_count: defect_buf.count,
    die_positions: Buffer::from(die_buf.positions),
    die_defect_counts: Buffer::from(die_buf.defect_counts),
    die_defect_starts: Buffer::from(die_buf.defect_starts),
    die_count: die_buf.count,
  })
}

#[napi]
pub fn parse_klarf_buffer(buffer: Buffer) -> napi::Result<JsKlarfResult> {
  let bytes: &[u8] = &buffer;
  let data = parser::parse_klarf_bytes(bytes)
    .map_err(|e| napi::Error::from_reason(format!("KLARF parse error: {}", e)))?;

  let info = &data.wafer_info;
  let js_info = JsWaferInfo {
    wafer_id: info.wafer_id.clone(),
    die_pitch_x: info.die_pitch_x,
    die_pitch_y: info.die_pitch_y,
    die_origin_x: info.die_origin_x,
    die_origin_y: info.die_origin_y,
    center_x: info.center_x,
    center_y: info.center_y,
    diameter: info.diameter,
    total_dies: data.dies.len() as u32,
    total_defects: data.defects.len() as u32,
  };

  let defect_buf = buffer::pack_defects(&data.defects);
  let die_buf = buffer::pack_dies(&data.dies);

  Ok(JsKlarfResult {
    wafer_info: js_info,
    defect_positions: Buffer::from(defect_buf.positions),
    defect_classes: Buffer::from(defect_buf.classes),
    defect_die_indices: Buffer::from(defect_buf.die_indices),
    defect_count: defect_buf.count,
    die_positions: Buffer::from(die_buf.positions),
    die_defect_counts: Buffer::from(die_buf.defect_counts),
    die_defect_starts: Buffer::from(die_buf.defect_starts),
    die_count: die_buf.count,
  })
}
