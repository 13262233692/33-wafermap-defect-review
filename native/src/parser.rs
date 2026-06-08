use crate::klarf::{KlarfData, WaferInfo, DieRecord, DefectRecord};
use memmap2::Mmap;
use std::fs::File;
use std::path::Path;

#[inline]
fn parse_val<T: std::str::FromStr>(s: &str) -> Option<T> {
  s.trim_end_matches(';').parse().ok()
}

#[inline]
fn get_val<'a>(vals: &'a [&str], idx: usize) -> &'a str {
  vals.get(idx).map(|v| *v).unwrap_or("").trim_end_matches(';')
}

pub struct ParseProgress {
  pub phase: String,
  pub percent: u32,
}

pub type ProgressCallback = Box<dyn Fn(ParseProgress) + Send>;

pub fn parse_klarf_mmap(path: &str, on_progress: Option<&ProgressCallback>) -> Result<KlarfData, String> {
  let file_path = Path::new(path);
  if !file_path.exists() {
    return Err(format!("File not found: {}", path));
  }

  let file = File::open(path).map_err(|e| format!("Cannot open file: {}", e))?;
  let metadata = file.metadata().map_err(|e| format!("Cannot read metadata: {}", e))?;
  let file_size = metadata.len();

  if let Some(cb) = on_progress {
    cb(ParseProgress { phase: "mmap".into(), percent: 5 });
  }

  let mmap = unsafe { Mmap::map(&file) }.map_err(|e| format!("mmap failed: {}", e))?;

  if let Some(cb) = on_progress {
    cb(ParseProgress { phase: "validate".into(), percent: 10 });
  }

  let data = parse_klarf_bytes_with_progress(&mmap, file_size, on_progress)?;

  Ok(data)
}

pub fn parse_klarf_bytes_with_progress(
  data: &[u8],
  _file_size: u64,
  on_progress: Option<&ProgressCallback>,
) -> Result<KlarfData, String> {
  let text = std::str::from_utf8(data)
    .map_err(|e| format!("Invalid UTF-8 in KLARF file: {}", e))?;

  if let Some(cb) = on_progress {
    cb(ParseProgress { phase: "scan".into(), percent: 15 });
  }

  let mut wafer_id = String::from("UNKNOWN");
  let mut die_pitch_x: f64 = 0.0;
  let mut die_pitch_y: f64 = 0.0;
  let mut die_origin_x: f64 = 0.0;
  let mut die_origin_y: f64 = 0.0;
  let mut center_x: f64 = 0.0;
  let mut center_y: f64 = 0.0;
  let mut diameter: f64 = 300.0;

  let mut defect_records: Vec<DefectRecord> = Vec::new();
  let mut die_records: Vec<DieRecord> = Vec::new();

  let lines: Vec<&str> = text.lines().collect();
  let total_lines = lines.len();
  let mut i = 0;

  let progress_interval = if total_lines > 100_000 { total_lines / 50 } else { total_lines };

  while i < total_lines {
    if i % progress_interval == 0 {
      if let Some(cb) = on_progress {
        let pct = 15 + ((i as u64 * 70) / total_lines as u64).min(70) as u32;
        cb(ParseProgress { phase: "parse".into(), percent: pct });
      }
    }

    let line = lines[i].trim();

    if line.starts_with("FileRecipe") || line.starts_with("ResultTimestamp") {
      i += 1;
      continue;
    }

    if let Some(rest) = extract_field(line, "WaferID") {
      wafer_id = rest.trim_end_matches(';').trim().trim_matches('"').to_string();
    }

    if let Some(rest) = extract_field(line, "DiePitch") {
      let parts: Vec<&str> = rest.split_whitespace().collect();
      if parts.len() >= 2 {
        die_pitch_x = parts[0].parse::<f64>().unwrap_or(0.0);
        die_pitch_y = parts[1].parse::<f64>().unwrap_or(0.0);
      }
    }

    if let Some(rest) = extract_field(line, "DieOrigin") {
      let parts: Vec<&str> = rest.split_whitespace().collect();
      if parts.len() >= 2 {
        die_origin_x = parts[0].parse::<f64>().unwrap_or(0.0);
        die_origin_y = parts[1].parse::<f64>().unwrap_or(0.0);
      }
    }

    if let Some(rest) = extract_field(line, "CenterLocation") {
      let parts: Vec<&str> = rest.split_whitespace().collect();
      if parts.len() >= 2 {
        center_x = parts[0].parse::<f64>().unwrap_or(0.0);
        center_y = parts[1].parse::<f64>().unwrap_or(0.0);
      }
    }

    if let Some(rest) = extract_field(line, "WaferDiameter") {
      diameter = rest.split_whitespace().next()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(300.0);
    }

    if line.starts_with("DefectRecord") {
      let count_str = line.split_whitespace().nth(1).unwrap_or("0");
      let count: usize = count_str.parse().unwrap_or(0);

      if count > 0 {
        i += 1;
        let fields_line = lines.get(i).map(|l| l.trim()).unwrap_or("");
        let fields: Vec<&str> = fields_line.split_whitespace().collect();

        let mut defect_id_idx = 0usize;
        let mut xrel_idx = 1usize;
        let mut yrel_idx = 2usize;
        let mut xindex_idx = 3usize;
        let mut yindex_idx = 4usize;
        let mut class_idx: Option<usize> = None;
        let mut bin_idx: Option<usize> = None;
        let mut area_idx: Option<usize> = None;

        for (fi, field) in fields.iter().enumerate() {
          let f = field.trim_end_matches(';');
          match f {
            "DEFECTID" => defect_id_idx = fi,
            "XREL" => xrel_idx = fi,
            "YREL" => yrel_idx = fi,
            "XINDEX" => xindex_idx = fi,
            "YINDEX" => yindex_idx = fi,
            "CLASS" | "DEFECTCLASS" => class_idx = Some(fi),
            "BIN" | "DEFECTBIN" => bin_idx = Some(fi),
            "AREA" => area_idx = Some(fi),
            _ => {}
          }
        }

        if defect_records.capacity() == 0 && count > 0 {
          defect_records.reserve(count);
        }

        for j in 0..count {
          i += 1;
          if i >= total_lines {
            break;
          }
          let defect_line = lines[i].trim();
          if defect_line.is_empty() || defect_line.starts_with(';') {
            continue;
          }
          let vals: Vec<&str> = defect_line.split_whitespace().collect();

          let defect = DefectRecord {
            defect_id: parse_val(get_val(&vals, defect_id_idx)).unwrap_or(j as u32),
            x_rel: parse_val(get_val(&vals, xrel_idx)).unwrap_or(0.0),
            y_rel: parse_val(get_val(&vals, yrel_idx)).unwrap_or(0.0),
            x_index: parse_val(get_val(&vals, xindex_idx)).unwrap_or(0),
            y_index: parse_val(get_val(&vals, yindex_idx)).unwrap_or(0),
            die_index: 0,
            defect_class: class_idx
              .and_then(|ci| parse_val(get_val(&vals, ci)))
              .unwrap_or(0),
            bin: bin_idx
              .and_then(|bi| parse_val(get_val(&vals, bi)))
              .unwrap_or(0),
            area: area_idx
              .and_then(|ai| parse_val(get_val(&vals, ai)))
              .unwrap_or(0.0),
          };
          defect_records.push(defect);
        }
      }
    }

    if line.starts_with("DieRecord") {
      let count_str = line.split_whitespace().nth(1).unwrap_or("0");
      let count: usize = count_str.parse().unwrap_or(0);

      if count > 0 {
        i += 1;
        let fields_line = lines.get(i).map(|l| l.trim()).unwrap_or("");
        let fields: Vec<&str> = fields_line.split_whitespace().collect();

        let mut diex_idx = 0usize;
        let mut diey_idx = 1usize;
        let mut defect_count_idx: Option<usize> = None;
        let mut defect_start_idx: Option<usize> = None;

        for (fi, field) in fields.iter().enumerate() {
          let f = field.trim_end_matches(';');
          match f {
            "DIEX" | "DIEID" => diex_idx = fi,
            "DIEY" => diey_idx = fi,
            "DEFECTCOUNT" => defect_count_idx = Some(fi),
            "DEFECTSTARTINDEX" => defect_start_idx = Some(fi),
            _ => {}
          }
        }

        if die_records.capacity() == 0 && count > 0 {
          die_records.reserve(count);
        }

        let mut global_defect_offset = defect_records.len() as u32;

        for _j in 0..count {
          i += 1;
          if i >= total_lines {
            break;
          }
          let die_line = lines[i].trim();
          if die_line.is_empty() || die_line.starts_with(';') {
            continue;
          }
          let vals: Vec<&str> = die_line.split_whitespace().collect();

          let die_x = parse_val(get_val(&vals, diex_idx)).unwrap_or(0);
          let die_y = parse_val(get_val(&vals, diey_idx)).unwrap_or(0);

          let dcount = defect_count_idx
            .and_then(|ci| parse_val(get_val(&vals, ci)))
            .unwrap_or(0);

          let dstart = defect_start_idx
            .and_then(|si| parse_val(get_val(&vals, si)))
            .unwrap_or(global_defect_offset);

          let die_idx = die_records.len() as u32;

          if dcount > 0 {
            for k in 0..dcount {
              let defect_idx = (dstart + k) as usize;
              if defect_idx < defect_records.len() {
                defect_records[defect_idx].die_index = die_idx;
              }
            }
          }

          die_records.push(DieRecord {
            die_x,
            die_y,
            defect_count: dcount,
            defect_start_index: dstart,
          });

          global_defect_offset += dcount;
        }
      }
    }

    i += 1;
  }

  if let Some(cb) = on_progress {
    cb(ParseProgress { phase: "done".into(), percent: 85 });
  }

  let wafer_info = WaferInfo {
    wafer_id,
    die_pitch_x,
    die_pitch_y,
    die_origin_x,
    die_origin_y,
    center_x,
    center_y,
    diameter,
  };

  Ok(KlarfData {
    wafer_info,
    dies: die_records,
    defects: defect_records,
  })
}

#[inline]
fn extract_field<'a>(line: &'a str, field_name: &str) -> Option<&'a str> {
  let trimmed = line.trim_end_matches(';').trim();
  let prefix = format!("{} ", field_name);
  if trimmed.starts_with(&prefix) {
    Some(&trimmed[field_name.len() + 1..])
  } else {
    let prefix_eq = format!("{}=", field_name);
    if trimmed.starts_with(&prefix_eq) {
      Some(&trimmed[field_name.len() + 1..])
    } else {
      None
    }
  }
}
