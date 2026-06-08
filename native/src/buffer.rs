use crate::klarf::{DefectRecord, DieRecord};

pub struct SharedDefectBuffer {
  pub positions: Vec<u8>,
  pub classes: Vec<u8>,
  pub die_indices: Vec<u8>,
  pub count: u32,
}

pub struct SharedDieBuffer {
  pub positions: Vec<u8>,
  pub defect_counts: Vec<u8>,
  pub defect_starts: Vec<u8>,
  pub count: u32,
}

pub fn pack_defects_into_shared(defects: &[DefectRecord]) -> SharedDefectBuffer {
  let count = defects.len() as u32;
  let pos_size = count as usize * 16;
  let class_size = count as usize;
  let die_idx_size = count as usize * 4;

  let mut positions = Vec::with_capacity(pos_size);
  let mut classes = Vec::with_capacity(class_size);
  let mut die_indices = Vec::with_capacity(die_idx_size);

  for d in defects {
    positions.extend_from_slice(&d.x_rel.to_le_bytes());
    positions.extend_from_slice(&d.y_rel.to_le_bytes());
    classes.push(d.defect_class);
    die_indices.extend_from_slice(&d.die_index.to_le_bytes());
  }

  positions.shrink_to_fit();
  classes.shrink_to_fit();
  die_indices.shrink_to_fit();

  SharedDefectBuffer {
    positions,
    classes,
    die_indices,
    count,
  }
}

pub fn pack_dies_into_shared(dies: &[DieRecord]) -> SharedDieBuffer {
  let count = dies.len() as u32;
  let pos_size = count as usize * 8;
  let count_size = count as usize * 4;
  let start_size = count as usize * 4;

  let mut positions = Vec::with_capacity(pos_size);
  let mut defect_counts = Vec::with_capacity(count_size);
  let mut defect_starts = Vec::with_capacity(start_size);

  for d in dies {
    positions.extend_from_slice(&d.die_x.to_le_bytes());
    positions.extend_from_slice(&d.die_y.to_le_bytes());
    defect_counts.extend_from_slice(&d.defect_count.to_le_bytes());
    defect_starts.extend_from_slice(&d.defect_start_index.to_le_bytes());
  }

  positions.shrink_to_fit();
  defect_counts.shrink_to_fit();
  defect_starts.shrink_to_fit();

  SharedDieBuffer {
    positions,
    defect_counts,
    defect_starts,
    count,
  }
}
