#[derive(Debug, Clone)]
pub struct WaferInfo {
  pub wafer_id: String,
  pub die_pitch_x: f64,
  pub die_pitch_y: f64,
  pub die_origin_x: f64,
  pub die_origin_y: f64,
  pub center_x: f64,
  pub center_y: f64,
  pub diameter: f64,
}

#[derive(Debug, Clone)]
pub struct DieRecord {
  pub die_x: i32,
  pub die_y: i32,
  pub defect_count: u32,
  pub defect_start_index: u32,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct DefectRecord {
  pub defect_id: u32,
  pub x_rel: f64,
  pub y_rel: f64,
  pub x_index: i32,
  pub y_index: i32,
  pub die_index: u32,
  pub defect_class: u8,
  pub bin: u8,
  pub area: f64,
}

#[derive(Debug, Clone)]
pub struct KlarfData {
  pub wafer_info: WaferInfo,
  pub dies: Vec<DieRecord>,
  pub defects: Vec<DefectRecord>,
}
