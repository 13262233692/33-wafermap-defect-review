#[cfg(test)]
mod tests {
    use crate::parser::parse_klarf_bytes_with_progress;

    fn parse_klarf_bytes(data: &[u8]) -> Result<crate::klarf::KlarfData, String> {
        parse_klarf_bytes_with_progress(data, data.len() as u64, None)
    }

    #[test]
    fn test_parse_minimal_klarf() {
        let data = br#"FileRecipe 4.0;
WaferID "TEST-W01";
DiePitch 10.0 10.0;
DieOrigin 0.0 0.0;
WaferDiameter 300.0;
CenterLocation 0.0 0.0;
DefectRecord 3
  DEFECTID XREL YREL XINDEX YINDEX CLASS BIN AREA;
  1 12.5 23.7 1 2 1 1 15.3;
  2 45.2 67.8 4 6 2 1 22.1;
  3 -78.3 -45.6 -7 -4 3 2 8.7;
DieRecord 2
  DIEX DIEY DEFECTCOUNT DEFECTSTARTINDEX;
  1 2 2 0;
  4 6 1 2;
EndInspectionStep;
"#;

        let result = parse_klarf_bytes(data).unwrap();

        assert_eq!(result.wafer_info.wafer_id, "TEST-W01");
        assert_eq!(result.wafer_info.die_pitch_x, 10.0);
        assert_eq!(result.wafer_info.die_pitch_y, 10.0);
        assert_eq!(result.wafer_info.diameter, 300.0);
        assert_eq!(result.wafer_info.center_x, 0.0);
        assert_eq!(result.wafer_info.center_y, 0.0);

        assert_eq!(result.defects.len(), 3);
        assert_eq!(result.dies.len(), 2);

        assert_eq!(result.defects[0].defect_id, 1);
        assert!((result.defects[0].x_rel - 12.5).abs() < 0.01);
        assert!((result.defects[0].y_rel - 23.7).abs() < 0.01);
        assert_eq!(result.defects[0].defect_class, 1);

        assert_eq!(result.defects[1].defect_id, 2);
        assert_eq!(result.defects[1].defect_class, 2);

        assert_eq!(result.defects[2].defect_id, 3);
        assert!((result.defects[2].x_rel - (-78.3)).abs() < 0.01);

        assert_eq!(result.dies[0].die_x, 1);
        assert_eq!(result.dies[0].die_y, 2);
        assert_eq!(result.dies[0].defect_count, 2);
        assert_eq!(result.dies[0].defect_start_index, 0);

        assert_eq!(result.dies[1].die_x, 4);
        assert_eq!(result.dies[1].die_y, 6);
        assert_eq!(result.dies[1].defect_count, 1);
        assert_eq!(result.dies[1].defect_start_index, 2);
    }

    #[test]
    fn test_parse_wafer_id_with_quotes() {
        let data = br#"WaferID "WAFER-123";
DefectRecord 0
"#;
        let result = parse_klarf_bytes(data).unwrap();
        assert_eq!(result.wafer_info.wafer_id, "WAFER-123");
    }

    #[test]
    fn test_parse_empty_defects() {
        let data = br#"WaferID "EMPTY";
DefectRecord 0
DieRecord 0
"#;
        let result = parse_klarf_bytes(data).unwrap();
        assert_eq!(result.defects.len(), 0);
        assert_eq!(result.dies.len(), 0);
    }

    #[test]
    fn test_parse_large_batch() {
        let mut data = String::from("WaferID \"STRESS\";\nDiePitch 10.0 10.0;\nWaferDiameter 300.0;\nCenterLocation 0.0 0.0;\n");

        let num_defects = 100000;
        data.push_str(&format!("DefectRecord {}\n  DEFECTID XREL YREL XINDEX YINDEX CLASS BIN AREA;\n", num_defects));

        let radius = 150.0_f64;
        let r2 = radius * radius;
        let mut idx = 0u32;
        for i in 0..num_defects {
            let angle = (i as f64 / num_defects as f64) * std::f64::consts::PI * 2.0;
            let r = (i as f64 / num_defects as f64) * radius * 0.9;
            let x = r * angle.cos();
            let y = r * angle.sin();
            if x * x + y * y > r2 { continue; }
            data.push_str(&format!("{} {:.2} {:.2} {} {} {} {} {:.1};\n",
                idx, x, y, (x / 10.0) as i32, (y / 10.0) as i32,
                (i % 8) as u8, (i % 4) as u8, (i as f64 * 0.5) % 100.0));
            idx += 1;
        }

        let result = parse_klarf_bytes(data.as_bytes()).unwrap();
        assert!(result.defects.len() > 0);
        assert_eq!(result.wafer_info.wafer_id, "STRESS");
    }
}
