use crate::klarf::{DefectRecord, DieRecord};

pub struct PackedDefectBuffer {
  pub positions: Vec<u8>,
  pub classes: Vec<u8>,
  pub die_indices: Vec<u8>,
  pub count: u32,
}

pub struct PackedDieBuffer {
  pub positions: Vec<u8>,
  pub defect_counts: Vec<u8>,
  pub defect_starts: Vec<u8>,
  pub count: u32,
}

pub fn pack_defects(defects: &[DefectRecord]) -> PackedDefectBuffer {
  let count = defects.len() as u32;
  let mut positions = Vec::with_capacity(count as usize * 8);
  let mut classes = Vec::with_capacity(count as usize);
  let mut die_indices = Vec::with_capacity(count as usize * 4);

  for d in defects {
    let x_bytes = d.x_rel.to_le_bytes();
    let y_bytes = d.y_rel.to_le_bytes();
    positions.extend_from_slice(&x_bytes);
    positions.extend_from_slice(&y_bytes);

    classes.push(d.defect_class);

    die_indices.extend_from_slice(&d.die_index.to_le_bytes());
  }

  PackedDefectBuffer {
    positions,
    classes,
    die_indices,
    count,
  }
}

pub fn pack_dies(dies: &[DieRecord]) -> PackedDieBuffer {
  let count = dies.len() as u32;
  let mut positions = Vec::with_capacity(count as usize * 8);
  let mut defect_counts = Vec::with_capacity(count as usize * 4);
  let mut defect_starts = Vec::with_capacity(count as usize * 4);

  for d in dies {
    let x_bytes = d.die_x.to_le_bytes();
    let y_bytes = d.die_y.to_le_bytes();
    positions.extend_from_slice(&x_bytes);
    positions.extend_from_slice(&y_bytes);

    defect_counts.extend_from_slice(&d.defect_count.to_le_bytes());
    defect_starts.extend_from_slice(&d.defect_start_index.to_le_bytes());
  }

  PackedDieBuffer {
    positions,
    defect_counts,
    defect_starts,
    count,
  }
}
