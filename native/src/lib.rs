mod klarf;
mod parser;
mod buffer;

#[cfg(test)]
mod parser_test;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use napi::threadsafe_function::{ThreadsafeFunction, ErrorStrategy, ThreadsafeFunctionCallMode};

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
pub struct JsSharedKlarfResult {
  pub wafer_info: JsWaferInfo,
  pub defect_positions: Uint8Array,
  pub defect_classes: Uint8Array,
  pub defect_die_indices: Uint8Array,
  pub defect_count: u32,
  pub die_positions: Uint8Array,
  pub die_defect_counts: Uint8Array,
  pub die_defect_starts: Uint8Array,
  pub die_count: u32,
}

#[napi(object)]
pub struct JsProgress {
  pub phase: String,
  pub percent: u32,
}

unsafe fn vec_to_uint8array(data: Vec<u8>) -> Uint8Array {
  if data.is_empty() {
    return Uint8Array::new(Vec::new());
  }
  let len = data.len();
  let ptr = Box::into_raw(data.into_boxed_slice()) as *mut u8;
  Uint8Array::with_external_data(ptr, len, |ptr: *mut u8, len: usize| {
    let _ = unsafe { Vec::from_raw_parts(ptr, len, len) };
  })
}

#[napi]
pub fn parse_klarf_file_sync(path: String) -> napi::Result<JsSharedKlarfResult> {
  let data = parser::parse_klarf_mmap(&path, None)
    .map_err(|e| napi::Error::from_reason(format!("KLARF parse error: {}", e)))?;

  build_js_result(data)
}

#[napi]
pub fn parse_klarf_buffer_sync(buffer: Buffer) -> napi::Result<JsSharedKlarfResult> {
  let bytes: &[u8] = &buffer;
  let data = parser::parse_klarf_bytes_with_progress(bytes, bytes.len() as u64, None)
    .map_err(|e| napi::Error::from_reason(format!("KLARF parse error: {}", e)))?;

  build_js_result(data)
}

#[napi]
pub async fn parse_klarf_file_async(
  path: String,
  #[napi(ts_arg_type = "(progress: { phase: string, percent: number }) => void")] on_progress: ThreadsafeFunction<JsProgress, ErrorStrategy::Fatal>,
) -> napi::Result<JsSharedKlarfResult> {
  let path_clone = path.clone();

  let handle = std::thread::spawn(move || {
    let callback: Box<dyn Fn(parser::ParseProgress) + Send> = Box::new(move |p| {
      let js_progress = JsProgress {
        phase: p.phase.clone(),
        percent: p.percent,
      };
      on_progress.call(js_progress, ThreadsafeFunctionCallMode::NonBlocking);
    });

    parser::parse_klarf_mmap(&path_clone, Some(&callback))
  });

  let data = handle.join()
    .map_err(|_| napi::Error::from_reason("Parse thread panicked"))?
    .map_err(|e| napi::Error::from_reason(format!("KLARF parse error: {}", e)))?;

  build_js_result(data)
}

fn build_js_result(data: crate::klarf::KlarfData) -> napi::Result<JsSharedKlarfResult> {
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

  let defect_buf = buffer::pack_defects_into_shared(&data.defects);
  let die_buf = buffer::pack_dies_into_shared(&data.dies);

  Ok(JsSharedKlarfResult {
    wafer_info: js_info,
    defect_positions: unsafe { vec_to_uint8array(defect_buf.positions) },
    defect_classes: unsafe { vec_to_uint8array(defect_buf.classes) },
    defect_die_indices: unsafe { vec_to_uint8array(defect_buf.die_indices) },
    defect_count: defect_buf.count,
    die_positions: unsafe { vec_to_uint8array(die_buf.positions) },
    die_defect_counts: unsafe { vec_to_uint8array(die_buf.defect_counts) },
    die_defect_starts: unsafe { vec_to_uint8array(die_buf.defect_starts) },
    die_count: die_buf.count,
  })
}
